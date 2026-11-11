import { Config } from '@remotion/cli/config'

Config.setEntryPoint('./video/index.ts')
Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
Config.setConcurrency(4)
