import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root'

// The video reuses the app's real stylesheet and components, so the demo looks
// exactly like the shipped UI rather than an approximation of it.
import '../src/styles/tokens.css'
import '../src/styles/app.css'

registerRoot(RemotionRoot)
