import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import AuthLayout, { PasswordInput } from '../components/layout/AuthLayout';
import { Field, Input } from '../components/ui/Form';
import Button from '../components/ui/Button';
import { apiError } from '../utils/browser';
import { isTouchDevice } from '../utils/device';

const Login = () => {
  usePageTitle('Sign in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!email.trim()) next.email = 'Enter your email.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (error) {
      setErrors({ form: apiError(error, 'Could not sign in. Check your connection and try again.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to take today's attendance."
      footer={<>New to AttendTrack? <Link to="/signup" className="font-medium text-accent hover:underline">Create an account</Link></>}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Email" htmlFor="login-email" error={errors.email}>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!errors.email}
            autoFocus={!isTouchDevice()}
          />
        </Field>
        <Field label="Password" htmlFor="login-password" error={errors.password}>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
          />
        </Field>
        {errors.form && <p role="alert" className="rounded-md bg-danger/10 px-3.5 py-2.5 text-[14px] text-danger">{errors.form}</p>}
        <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
          {loading ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default Login;
