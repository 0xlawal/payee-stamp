import { useCallback, useEffect, useState } from 'react'
import { createWalletClient, custom, type WalletClient } from 'viem'
import type { Hex } from '../types'
import { CHAIN_ID, robinhoodChain } from './chain'

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

export interface WalletState {
  address: Hex | null
  chainId: number | null
  connecting: boolean
  error: string | null
  hasProvider: boolean
  connect: () => Promise<void>
  walletClient: WalletClient | null
  switchNetwork: () => Promise<void>
}

function getProvider(): Eip1193Provider | null {
  return typeof window !== 'undefined' && window.ethereum ? window.ethereum : null
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<Hex | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const provider = getProvider()

  const refresh = useCallback(async () => {
    if (!provider) return
    try {
      const accounts = (await provider.request({ method: 'eth_accounts' })) as Hex[]
      setAddress(accounts?.[0] ?? null)

      const chainHex = (await provider.request({ method: 'eth_chainId' })) as string
      setChainId(Number.parseInt(chainHex, 16))
    } catch {
      // A wallet that refuses eth_accounts before connection is normal.
    }
  }, [provider])

  useEffect(() => {
    void refresh()
    if (!provider?.on) return

    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as Hex[]
      setAddress(accounts?.[0] ?? null)
    }
    const onChain = (...args: unknown[]) => {
      const hex = args[0] as string
      setChainId(Number.parseInt(hex, 16))
    }

    provider.on('accountsChanged', onAccounts)
    provider.on('chainChanged', onChain)

    return () => {
      provider.removeListener?.('accountsChanged', onAccounts)
      provider.removeListener?.('chainChanged', onChain)
    }
  }, [provider, refresh])

  const connect = useCallback(async () => {
    if (!provider) {
      setError('No browser wallet detected. Install a compatible wallet to pay.')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as Hex[]
      setAddress(accounts?.[0] ?? null)

      const chainHex = (await provider.request({ method: 'eth_chainId' })) as string
      setChainId(Number.parseInt(chainHex, 16))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet connection was rejected.')
    } finally {
      setConnecting(false)
    }
  }, [provider])

  const switchNetwork = useCallback(async () => {
    if (!provider) return
    setError(null)
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
      })
    } catch (err) {
      const code = (err as { code?: number }).code
      // 4902: chain unknown to the wallet, so offer to add it.
      if (code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${CHAIN_ID.toString(16)}`,
                chainName: robinhoodChain.name,
                nativeCurrency: robinhoodChain.nativeCurrency,
                rpcUrls: [robinhoodChain.rpcUrls.default.http[0]],
                blockExplorerUrls: [robinhoodChain.blockExplorers.default.url],
              },
            ],
          })
          return
        } catch (addErr) {
          setError(addErr instanceof Error ? addErr.message : 'Could not add the network.')
          return
        }
      }
      setError(err instanceof Error ? err.message : 'Could not switch network.')
    }
  }, [provider])

  const walletClient = provider
    ? createWalletClient({ chain: robinhoodChain, transport: custom(provider) })
    : null

  return {
    address,
    chainId,
    connecting,
    error,
    hasProvider: provider !== null,
    connect,
    walletClient,
    switchNetwork,
  }
}
