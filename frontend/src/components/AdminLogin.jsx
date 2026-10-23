import { useState } from 'react';
import api from '../services/api.js';

export default function AdminLogin({ onSuccess, onShop }) {
  const query = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(query.get('email') || '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [resetToken, setResetToken] = useState(query.get('reset_token') || '');
  const [mode, setMode] = useState(query.get('reset_token') ? 'reset' : 'login');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'forgot') {
        const response = await api.post('/auth/password/forgot', { email });
        setNotice(response.data.message);
        return;
      }
      if (mode === 'reset') {
        const response = await api.post('/auth/password/reset', {
          email,
          token: resetToken,
          password,
          password_confirmation: passwordConfirmation,
        });
        setNotice(response.data.message);
        setMode('login');
        setResetToken('');
        setPassword('');
        setPasswordConfirmation('');
        window.history.replaceState({}, '', '/login');
        return;
      }

      const response = await api.post('/auth/login', { email, password });
      if (!['admin', 'fulfillment'].includes(response.data.data.role)) {
        await api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${response.data.token}` } }).catch(() => {});
        setError('This account does not have store team access.');
        return;
      }
      onSuccess(response.data.data, response.data.token);
    } catch (requestError) {
      const validationMessage = Object.values(requestError.response?.data?.errors || {}).flat()[0];
      setError(validationMessage || requestError.response?.data?.message || 'The request could not be completed.');
    } finally {
      setLoading(false);
    }
  }

  const title = mode === 'login' ? 'Welcome back.' : mode === 'forgot' ? 'Reset your password.' : 'Choose a new password.';

  return <main className="admin-login-shell">
    <header className="market-header">
      <a className="market-brand" href="/shop" onClick={(event) => { event.preventDefault(); onShop(); }}><span className="market-brand-mark">f.</span><strong>fieldnotes</strong></a>
      <button className="market-admin" type="button" onClick={onShop}><span>Looking for the store?</span><strong>Shop the collection</strong></button>
    </header>
    <div className="admin-login-card">
      <div className="admin-login-mark">f.</div>
      <p className="checkout-step">STORE TEAM ACCESS</p>
      <h1>{title}</h1>
      <p>{mode === 'login' ? 'Sign in to manage your catalogue and store operations.' : mode === 'forgot' ? 'Enter your administrator email and we will send a reset link if it matches an account.' : `Set a new password for ${email}.`}</p>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {notice && <div className="banner banner-success" role="status">{notice}</div>}
      <form onSubmit={submit}>
        <label className="checkout-field"><span>Email address</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        {mode !== 'forgot' && <label className="checkout-field"><span>{mode === 'reset' ? 'New password' : 'Password'}</span><input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'login' ? undefined : 10} /></label>}
        {mode === 'reset' && <label className="checkout-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required minLength="10" /></label>}
        <button className="checkout-place-order" type="submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in to workspace' : mode === 'forgot' ? 'Send reset link' : 'Reset password'}</button>
      </form>
      {mode === 'login' && <button className="confirmation-shop" type="button" onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}>Forgot your password?</button>}
      {mode === 'reset' && <button className="confirmation-shop" type="button" onClick={() => { setMode('forgot'); setResetToken(''); window.history.replaceState({}, '', '/login'); }}>Request another reset link</button>}
      {mode === 'forgot' && <button className="confirmation-shop" type="button" onClick={() => { setMode('login'); setError(''); setNotice(''); }}>Back to sign in</button>}
      <p className="admin-login-note">Store admins use <code>php artisan app:make-admin</code>; fulfillment staff use <code>php artisan app:make-fulfillment-staff</code>.</p>
      <button className="confirmation-shop" type="button" onClick={onShop}>Return to the shop</button>
    </div>
  </main>;
}
