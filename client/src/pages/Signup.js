import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import AuthLayout, { PasswordInput } from '../components/layout/AuthLayout';
import { Field, Input } from '../components/ui/Form';
import Button from '../components/ui/Button';
import { apiError } from '../utils/browser';

const Signup = () => {
  usePageTitle('Create account');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter at least 2 characters.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.password.length < 6) next.password = 'Use at least 6 characters.';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await signup(form.name.trim(), form.email.trim(), form.password);
      navigate('/');
    } catch (error) {
      setErrors({ form: apiError(error, 'Could not create the account. Try again.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your coach account"
      subtitle="Set up your roster and start tracking in a few minutes."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-accent hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Full name" htmlFor="signup-name" error={errors.name}>
          <Input id="signup-name" value={form.name} onChange={set('name')} autoComplete="name" aria-invalid={!!errors.name} autoFocus />
        </Field>
        <Field label="Email" htmlFor="signup-email" error={errors.email}>
          <Input id="signup-email" type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="email" aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="signup-password" error={errors.password} hint="At least 6 characters.">
          <PasswordInput id="signup-password" value={form.password} onChange={set('password')} autoComplete="new-password" aria-invalid={!!errors.password} />
        </Field>
        <Field label="Confirm password" htmlFor="signup-confirm" error={errors.confirm}>
          <PasswordInput id="signup-confirm" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" aria-invalid={!!errors.confirm} />
        </Field>
        {errors.form && <p role="alert" className="rounded-md bg-danger/10 px-3.5 py-2.5 text-[14px] text-danger">{errors.form}</p>}
        <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
          {loading ? 'Creating account' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default Signup;
