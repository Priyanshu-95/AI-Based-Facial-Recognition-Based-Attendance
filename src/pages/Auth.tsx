import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import FaceScannerAnimation from '@/components/FaceScannerAnimation';
import FaceCapture from '@/components/FaceCapture';
import FaceScanAttendance from '@/components/FaceScanAttendance';
import { Eye, EyeOff, Mail, Lock, User, Phone, Hash, ArrowLeft, ArrowRight, Check, Scan } from 'lucide-react';
import { z } from 'zod';

// Validation schemas
const step2Schema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100, 'Full name must be less than 100 characters'),
  email: z.string().trim().email('Please enter a valid email address').max(255, 'Email must be less than 255 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be less than 128 characters'),
});

const step3Schema = z.object({
  rollNumber: z.string().max(20, 'Roll number must be less than 20 characters').optional().or(z.literal('')),
  phone: z.string().regex(/^$|^[0-9]{10}$/, 'Phone must be exactly 10 digits').optional().or(z.literal('')),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, loading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [showFaceScan, setShowFaceScan] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerFullName, setRegisterFullName] = useState('');
  const [registerRollNumber, setRegisterRollNumber] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerDepartment, setRegisterDepartment] = useState('');
  const [registerClass, setRegisterClass] = useState('');
  const [capturedFaceBlob, setCapturedFaceBlob] = useState<Blob | null>(null);

  useEffect(() => {
    const routeByRole = async () => {
      if (!user || loading) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      const role = data?.role;
      if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'teacher') navigate('/teacher/dashboard');
      else navigate('/student/dashboard');
    };
    routeByRole();
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Invalid email or password');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Logged in successfully!');
    }
  };

  const handleFaceCapture = (blob: Blob) => {
    setCapturedFaceBlob(blob);
    toast.success('Face captured successfully!');
  };

  const uploadFaceImage = async (userId: string, blob: Blob): Promise<string | null> => {
    const fileName = `${userId}/face-${Date.now()}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('face-images')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading face image:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('face-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateStep2 = () => {
    const result = step2Schema.safeParse({
      fullName: registerFullName,
      email: registerEmail,
      password: registerPassword,
    });
    
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setValidationErrors(errors);
      return false;
    }
    setValidationErrors({});
    return true;
  };

  const validateStep3 = () => {
    const result = step3Schema.safeParse({
      rollNumber: registerRollNumber,
      phone: registerPhone,
    });
    
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setValidationErrors(errors);
      return false;
    }
    setValidationErrors({});
    return true;
  };

  const handleStep2Next = () => {
    if (validateStep2()) {
      setRegistrationStep(3);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all steps
    if (!validateStep2() || !validateStep3()) {
      toast.error('Please fix the validation errors');
      return;
    }

    if (!capturedFaceBlob) {
      toast.error('Please capture your face photo first');
      setRegistrationStep(1);
      return;
    }

    setIsLoading(true);
    
    // Sign up the user (role is assigned server-side via trigger for security)
    const { error } = await signUp(registerEmail, registerPassword, registerFullName);

    if (error) {
      setIsLoading(false);
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please login instead.');
      } else {
        toast.error(error.message);
      }
      return;
    }

    // Wait for user to be created and get the user ID
    const { data: { user: newUser } } = await supabase.auth.getUser();
    
    if (newUser) {
      // Upload face image
      const faceImageUrl = await uploadFaceImage(newUser.id, capturedFaceBlob);

      // Update profile with additional info
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          roll_number: registerRollNumber || null,
          phone: registerPhone || null,
          department: registerDepartment || null,
          class: registerClass || null,
          face_image_url: faceImageUrl
        })
        .eq('user_id', newUser.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }
    }

    setIsLoading(false);
    toast.success('Account created successfully!');
  };

  const canProceedToStep2 = capturedFaceBlob !== null;
  const canProceedToStep3 = registerFullName && registerEmail && registerPassword && registerPassword.length >= 8;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <FaceScannerAnimation size={100} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-lg bg-card/80 backdrop-blur-xl border-border/50 glow-border-blue relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <FaceScannerAnimation size={60} />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            AI Attendance System
          </CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full glow-blue" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>

                {/* Face Scan Attendance Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                {/* Face Scan Attendance Button */}
                <Button 
                  type="button" 
                  variant="outline"
                  className="w-full glow-border-purple gap-2"
                  onClick={() => setShowFaceScan(true)}
                >
                  <Scan className="w-4 h-4" />
                  Mark Attendance (Face Scan)
                </Button>
              </form>

              {/* Face Scan Modal */}
              <FaceScanAttendance 
                isOpen={showFaceScan} 
                onClose={() => setShowFaceScan(false)} 
              />
            </TabsContent>

            <TabsContent value="register">
              {/* Step indicators */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        registrationStep === step 
                          ? 'bg-primary text-primary-foreground' 
                          : registrationStep > step 
                            ? 'bg-green-500 text-white' 
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {registrationStep > step ? <Check className="w-4 h-4" /> : step}
                    </div>
                    {step < 3 && (
                      <div className={`w-8 h-0.5 ${registrationStep > step ? 'bg-green-500' : 'bg-muted'}`} />
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleRegister}>
                {/* Step 1: Face Capture */}
                {registrationStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-center">Capture Your Face</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      This will be used for face recognition attendance
                    </p>
                    <div className="flex justify-center py-4">
                      <FaceCapture onCapture={handleFaceCapture} />
                    </div>
                    <Button 
                      type="button" 
                      className="w-full gap-2"
                      onClick={() => setRegistrationStep(2)}
                      disabled={!canProceedToStep2}
                    >
                      Next <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Step 2: Basic Info */}
                {registrationStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-center">Account Details</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Full Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-name"
                          type="text"
                          placeholder="John Doe"
                          value={registerFullName}
                          onChange={(e) => setRegisterFullName(e.target.value)}
                          className={`pl-10 ${validationErrors.fullName ? 'border-destructive' : ''}`}
                          maxLength={100}
                        />
                      </div>
                      {validationErrors.fullName && (
                        <p className="text-xs text-destructive">{validationErrors.fullName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="you@example.com"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          className={`pl-10 ${validationErrors.email ? 'border-destructive' : ''}`}
                          maxLength={255}
                        />
                      </div>
                      {validationErrors.email && (
                        <p className="text-xs text-destructive">{validationErrors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          className={`pl-10 pr-10 ${validationErrors.password ? 'border-destructive' : ''}`}
                          maxLength={128}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {validationErrors.password ? (
                        <p className="text-xs text-destructive">{validationErrors.password}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => setRegistrationStep(1)}
                      >
                        <ArrowLeft className="w-4 h-4" /> Back
                      </Button>
                      <Button 
                        type="button" 
                        className="flex-1 gap-2"
                        onClick={handleStep2Next}
                        disabled={!canProceedToStep3}
                      >
                        Next <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Additional Info */}
                {registrationStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-center">Additional Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="register-roll">Roll Number</Label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="register-roll"
                            type="text"
                            placeholder="e.g., 2024001"
                            value={registerRollNumber}
                            onChange={(e) => setRegisterRollNumber(e.target.value)}
                            className={`pl-10 ${validationErrors.rollNumber ? 'border-destructive' : ''}`}
                            maxLength={20}
                          />
                        </div>
                        {validationErrors.rollNumber && (
                          <p className="text-xs text-destructive">{validationErrors.rollNumber}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-phone">Phone</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="register-phone"
                            type="tel"
                            placeholder="e.g., 9876543210"
                            value={registerPhone}
                            onChange={(e) => setRegisterPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                            className={`pl-10 ${validationErrors.phone ? 'border-destructive' : ''}`}
                            maxLength={10}
                          />
                        </div>
                        {validationErrors.phone && (
                          <p className="text-xs text-destructive">{validationErrors.phone}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-department">Department</Label>
                      <Select value={registerDepartment} onValueChange={setRegisterDepartment}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="computer_science">Computer Science</SelectItem>
                          <SelectItem value="electronics">Electronics</SelectItem>
                          <SelectItem value="mechanical">Mechanical</SelectItem>
                          <SelectItem value="civil">Civil</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-class">Class</Label>
                      <Select value={registerClass} onValueChange={setRegisterClass}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first_year">First Year</SelectItem>
                          <SelectItem value="second_year">Second Year</SelectItem>
                          <SelectItem value="third_year">Third Year</SelectItem>
                          <SelectItem value="fourth_year">Fourth Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => setRegistrationStep(2)}
                      >
                        <ArrowLeft className="w-4 h-4" /> Back
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1 glow-blue" 
                        disabled={isLoading}
                      >
                        {isLoading ? 'Creating...' : 'Create Account'}
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
