// Authentication Modal Component for meal.it
import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import Alert from './Alert'

const AuthModal = ({ isOpen, onClose, mode: initialMode = 'signin', redirect }) => {
  const [mode, setMode] = useState(initialMode) // 'signin', 'signup', 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState({ show: false, message: '', type: 'info' })

  const router = useRouter()
  const { signIn, signUp, signInWithGoogle, resetPassword, error } = useAuth()

  const showAlert = (message, type = 'info') => {
    setAlert({ show: true, message, type })
    setTimeout(() => setAlert({ show: false, message: '', type: 'info' }), 4000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      let result
      
      if (mode === 'signin') {
        result = await signIn({ email, password })
        if (result.error) {
          showAlert(result.error.message, 'error')
        } else {
          showAlert('Welcome back to meal.it!', 'success')
          onClose()
          // redirect to requested destination or profile
          const dest = redirect || '/profile'
          setTimeout(() => router.replace(dest), 250)
        }
      } else if (mode === 'signup') {
        result = await signUp({ email, password })
        if (result.error) {
          showAlert(result.error.message, 'error')
        } else {
          showAlert('Welcome to meal.it! Please check your email to verify your account.', 'success')
          onClose()
          const dest = redirect || '/profile'
          setTimeout(() => router.replace(dest), 250)
        }
      } else if (mode === 'reset') {
        result = await resetPassword({ email })
        if (result.error) {
          showAlert(result.error.message, 'error')
        } else {
          showAlert('Password reset email sent! Check your inbox.', 'success')
          setMode('signin')
        }
      }
    } catch (error) {
      showAlert(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const result = await signInWithGoogle()
      if (result.error) {
        showAlert(result.error.message, 'error')
      } else {
        showAlert('Welcome to meal.it!', 'success')
        onClose()
        const dest = redirect || '/profile'
        setTimeout(() => router.replace(dest), 250)
      }
    } catch (error) {
      showAlert(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setDisplayName('')
    setAlert({ show: false, message: '', type: 'info' })
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    resetForm()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {mode === 'signin' && 'Welcome Back'}
            {mode === 'signup' && 'Join meal.it'}
            {mode === 'reset' && 'Reset Password'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Alert */}
        <Alert 
          show={alert.show} 
          message={alert.message} 
          type={alert.type} 
        />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                placeholder="How should we call you?"
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="your.email@example.com"
              required
              disabled={loading}
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                Processing...
              </div>
            ) : (
              <>
                {mode === 'signin' && 'Sign In'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'reset' && 'Send Reset Email'}
              </>
            )}
          </button>
        </form>

        {/* Google Sign In (only for signin/signup) */}
        {mode !== 'reset' && (
          <>
            <div className="flex items-center my-6">
              <hr className="flex-1 border-gray-300" />
              <span className="px-4 text-sm text-gray-500">or</span>
              <hr className="flex-1 border-gray-300" />
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}

        {/* Mode Switching Links */}
        <div className="mt-6 text-center text-sm text-gray-600">
          {mode === 'signin' && (
            <>
              <p>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => switchMode('signup')}
                  className="text-yellow-600 hover:text-yellow-700 font-semibold"
                  disabled={loading}
                >
                  Sign up
                </button>
              </p>
              <p className="mt-2">
                <button
                  onClick={() => switchMode('reset')}
                  className="text-yellow-600 hover:text-yellow-700 font-semibold"
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => switchMode('signin')}
                className="text-yellow-600 hover:text-yellow-700 font-semibold"
                disabled={loading}
              >
                Sign in
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <p>
              Remember your password?{' '}
              <button
                onClick={() => switchMode('signin')}
                className="text-yellow-600 hover:text-yellow-700 font-semibold"
                disabled={loading}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthModal