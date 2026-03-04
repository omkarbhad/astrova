import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { StarsBackground, CosmicOrbs } from '@/components/landing/ui/stars-background';

const RegisterPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [focusedInput, setFocusedInput] = useState<'name' | 'email' | 'password' | 'confirmPassword' | 'code' | null>(null);

  const { signUp, signInWithGoogle, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();

  // Already logged in → redirect to chart
  useEffect(() => {
    if (isLoaded && isSignedIn && !pendingVerification) {
      navigate('/chart', { replace: true });
    }
  }, [isLoaded, isSignedIn, pendingVerification, navigate]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(email, password, name);
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else if (result.needsVerification) {
        setPendingVerification(true);
        setSuccessMessage('Check your email for a confirmation link!');
        setLoading(false);
      }
      // On success: keep loading=true. useEffect redirects once isSignedIn confirms.
    } catch {
      setError('Sign-up failed. Please try again.');
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('Check your email for a confirmation link to verify your account.');
  };

  const handleGoogleSignUp = async () => {
    if (!isLoaded) return;
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      // Google OAuth triggers a full-page redirect — callbackURL handles navigation.
      // Only handle errors here; don't navigate manually.
      if (result.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch {
      setError('Google sign-up failed.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[hsl(24,16%,6%)] relative overflow-hidden flex items-center justify-center px-4 py-10">
      <StarsBackground />
      <CosmicOrbs />
      
      <div className="fixed inset-0 bg-[hsl(24,16%,6%)] -z-20" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(234,179,8,0.12),transparent)] -z-10" />
      
      <div className="fixed inset-0 pointer-events-none -z-30">
        <div className="absolute top-[40%] left-1/2 gradient w-3/4 -translate-x-1/2 h-1/4 md:h-1/3 inset-0 blur-[5rem] animate-image-glow" />
        <div className="absolute top-[30%] left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-[50%] right-1/4 w-72 h-72 bg-amber-600/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-[70%] left-1/3 w-80 h-80 bg-yellow-600/8 rounded-full blur-[110px] animate-pulse" />
      </div>

      <Link to="/" className="absolute top-6 left-6 flex items-center gap-2 text-amber-100/70 hover:text-amber-100 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-sm relative z-10"
        style={{ perspective: 1500 }}
      >
        <motion.div className="relative" style={{ rotateX, rotateY }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <div className="relative group">
            <motion.div
              className="absolute -inset-[1px] rounded-2xl"
              animate={{
                boxShadow: [
                  '0 0 10px 2px rgba(245,158,11,0.14)',
                  '0 0 15px 5px rgba(245,158,11,0.2)',
                  '0 0 10px 2px rgba(245,158,11,0.14)',
                ],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }}
            />

            <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
              <motion.div
                className="absolute top-0 left-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-70"
                initial={{ filter: 'blur(2px)' }}
                animate={{ left: ['-50%', '100%'], opacity: [0.3, 0.7, 0.3], filter: ['blur(1px)', 'blur(2.5px)', 'blur(1px)'] }}
                transition={{ left: { duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: 'mirror' }, filter: { duration: 1.5, repeat: Infinity, repeatType: 'mirror' } }}
              />
              <motion.div
                className="absolute top-0 right-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-amber-300 to-transparent opacity-70"
                initial={{ filter: 'blur(2px)' }}
                animate={{ top: ['-50%', '100%'], opacity: [0.3, 0.7, 0.3], filter: ['blur(1px)', 'blur(2.5px)', 'blur(1px)'] }}
                transition={{ top: { duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1, delay: 0.6 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: 'mirror', delay: 0.6 }, filter: { duration: 1.5, repeat: Infinity, repeatType: 'mirror', delay: 0.6 } }}
              />
              <motion.div
                className="absolute bottom-0 right-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-70"
                initial={{ filter: 'blur(2px)' }}
                animate={{ right: ['-50%', '100%'], opacity: [0.3, 0.7, 0.3], filter: ['blur(1px)', 'blur(2.5px)', 'blur(1px)'] }}
                transition={{ right: { duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1, delay: 1.2 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: 'mirror', delay: 1.2 }, filter: { duration: 1.5, repeat: Infinity, repeatType: 'mirror', delay: 1.2 } }}
              />
              <motion.div
                className="absolute bottom-0 left-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-amber-300 to-transparent opacity-70"
                initial={{ filter: 'blur(2px)' }}
                animate={{ bottom: ['-50%', '100%'], opacity: [0.3, 0.7, 0.3], filter: ['blur(1px)', 'blur(2.5px)', 'blur(1px)'] }}
                transition={{ bottom: { duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1, delay: 1.8 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: 'mirror', delay: 1.8 }, filter: { duration: 1.5, repeat: Infinity, repeatType: 'mirror', delay: 1.8 } }}
              />
            </div>

            <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-300/15 to-amber-500/10 opacity-70" />

            <div className="relative bg-[hsl(24,16%,8%)]/80 backdrop-blur-xl rounded-2xl p-6 border border-amber-500/20 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)',
                backgroundSize: '30px 30px',
              }} />

              <div className="text-center space-y-1 mb-8">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', duration: 0.8 }} className="mx-auto flex items-center justify-center relative">
                  <img src="/astrova_logo.png" alt="Astrova" className="w-8 h-8" />
                </motion.div>
                <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-amber-100 to-amber-300">
                  {pendingVerification ? 'Verify Email' : 'Create Account'}
                </motion.h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-neutral-400 text-xs">
                  {pendingVerification ? 'Enter the code sent to your email' : 'Sign up to save and sync your charts'}
                </motion.p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
              )}
              {successMessage && (
                <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-300">{successMessage}</div>
              )}

              {pendingVerification ? (
                <form onSubmit={handleVerify} className="space-y-4">
                  <motion.div className={`relative ${focusedInput === 'code' ? 'z-10' : ''}`} whileHover={{ scale: 1.01 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <Mail className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === 'code' ? 'text-amber-200' : 'text-amber-400/60'}`} />
                      <Input
                        type="text"
                        placeholder="Verification code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        onFocus={() => setFocusedInput('code')}
                        onBlur={() => setFocusedInput(null)}
                        className="w-full bg-[hsl(24,18%,9%)] border border-amber-500/15 focus:border-amber-500/35 text-white placeholder:text-neutral-500 h-10 transition-all duration-300 pl-10 pr-3 focus:bg-[hsl(24,20%,11%)] text-center tracking-widest"
                        required
                      />
                    </div>
                  </motion.div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading} className="w-full relative group/button">
                    <div className="absolute inset-0 bg-amber-500/20 rounded-lg blur-lg opacity-0 group-hover/button:opacity-80 transition-opacity duration-300" />
                    <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-medium h-10 rounded-lg transition-all duration-300 flex items-center justify-center">
                      <AnimatePresence mode="wait">
                        {loading ? (
                          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-amber-100/80 border-t-transparent rounded-full animate-spin" />
                          </motion.div>
                        ) : (
                          <motion.span key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-1 text-sm font-medium">
                            Verify & Continue
                            <ArrowRight className="w-3 h-3" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <motion.div className="space-y-3">
                    <motion.div className={`relative ${focusedInput === 'name' ? 'z-10' : ''}`} whileHover={{ scale: 1.01 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                      <div className="relative flex items-center overflow-hidden rounded-lg">
                        <User className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === 'name' ? 'text-amber-200' : 'text-amber-400/60'}`} />
                        <Input id="name" type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setFocusedInput('name')} onBlur={() => setFocusedInput(null)} className="w-full bg-[hsl(24,18%,9%)] border border-amber-500/15 focus:border-amber-500/35 text-white placeholder:text-neutral-500 h-10 transition-all duration-300 pl-10 pr-3 focus:bg-[hsl(24,20%,11%)]" />
                      </div>
                    </motion.div>

                    <motion.div className={`relative ${focusedInput === 'email' ? 'z-10' : ''}`} whileHover={{ scale: 1.01 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                      <div className="relative flex items-center overflow-hidden rounded-lg">
                        <Mail className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === 'email' ? 'text-amber-200' : 'text-amber-400/60'}`} />
                        <Input id="email" type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setFocusedInput('email')} onBlur={() => setFocusedInput(null)} className="w-full bg-[hsl(24,18%,9%)] border border-amber-500/15 focus:border-amber-500/35 text-white placeholder:text-neutral-500 h-10 transition-all duration-300 pl-10 pr-3 focus:bg-[hsl(24,20%,11%)]" required />
                      </div>
                    </motion.div>

                    <motion.div className={`relative ${focusedInput === 'password' ? 'z-10' : ''}`} whileHover={{ scale: 1.01 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                      <div className="relative flex items-center overflow-hidden rounded-lg">
                        <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === 'password' ? 'text-amber-200' : 'text-amber-400/60'}`} />
                        <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocusedInput('password')} onBlur={() => setFocusedInput(null)} className="w-full bg-[hsl(24,18%,9%)] border border-amber-500/15 focus:border-amber-500/35 text-white placeholder:text-neutral-500 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-[hsl(24,20%,11%)]" required />
                        <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 text-amber-400/70 hover:text-amber-200 transition-colors" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                          {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                    </motion.div>

                    <motion.div className={`relative ${focusedInput === 'confirmPassword' ? 'z-10' : ''}`} whileHover={{ scale: 1.01 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                      <div className="relative flex items-center overflow-hidden rounded-lg">
                        <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === 'confirmPassword' ? 'text-amber-200' : 'text-amber-400/60'}`} />
                        <Input id="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onFocus={() => setFocusedInput('confirmPassword')} onBlur={() => setFocusedInput(null)} className="w-full bg-[hsl(24,18%,9%)] border border-amber-500/15 focus:border-amber-500/35 text-white placeholder:text-neutral-500 h-10 transition-all duration-300 pl-10 pr-3 focus:bg-[hsl(24,20%,11%)]" required />
                      </div>
                    </motion.div>
                  </motion.div>

                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading} className="w-full relative group/button mt-2">
                    <div className="absolute inset-0 bg-amber-500/20 rounded-lg blur-lg opacity-0 group-hover/button:opacity-80 transition-opacity duration-300" />
                    <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-medium h-10 rounded-lg transition-all duration-300 flex items-center justify-center">
                      <AnimatePresence mode="wait">
                        {loading ? (
                          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-amber-100/80 border-t-transparent rounded-full animate-spin" />
                          </motion.div>
                        ) : (
                          <motion.span key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-1 text-sm font-medium">
                            Create Account
                            <ArrowRight className="w-3 h-3 group-hover/button:translate-x-1 transition-transform duration-300" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>

                  <div className="relative mt-2 mb-5 flex items-center">
                    <div className="flex-grow border-t border-amber-500/15" />
                    <motion.span className="mx-3 text-xs text-neutral-500" initial={{ opacity: 0.7 }} animate={{ opacity: [0.7, 0.9, 0.7] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>or</motion.span>
                    <div className="flex-grow border-t border-amber-500/15" />
                  </div>

                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" onClick={handleGoogleSignUp} disabled={loading} className="w-full relative group/google">
                    <div className="absolute inset-0 bg-amber-500/10 rounded-lg blur opacity-0 group-hover/google:opacity-70 transition-opacity duration-300" />
                    <div className="relative overflow-hidden bg-[hsl(24,18%,9%)] text-white font-medium h-10 rounded-lg border border-amber-500/20 hover:border-amber-500/35 transition-all duration-300 flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span className="text-neutral-300 group-hover/google:text-amber-100 transition-colors text-xs">Continue with Google</span>
                    </div>
                  </motion.button>

                  <motion.p className="text-center text-xs text-neutral-400 mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                    Already have an account?{' '}
                    <Link to="/login" className="relative inline-block group/signin">
                      <span className="relative z-10 text-amber-200 group-hover/signin:text-amber-100 transition-colors duration-300 font-medium">Sign in</span>
                      <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-amber-400 group-hover/signin:w-full transition-all duration-300" />
                    </Link>
                  </motion.p>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
