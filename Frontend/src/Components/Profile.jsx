import React, { useState, useEffect } from 'react';
import Header from './Header';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import './Home.css'; // reuse existing form styles

const Profile = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiClient.get('/users/profile');
        setFormData(prev => ({
          ...prev,
          full_name: res.data.full_name || '',
          email: res.data.email || '',
        }));
      } catch (err) {
        console.error('Failed to load profile:', err);
        toast.error('Could not load profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (formData.password && formData.password.length < 6)
      newErrors.password = 'Password must be at least 6 characters';
    if (formData.password && formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        full_name: formData.full_name,
        email: formData.email,
      };
      if (formData.password) payload.password = formData.password;

      const res = await apiClient.put('/users/profile', payload);

      // Update localStorage with new name/email
      const currentUser = JSON.parse(localStorage.getItem('user')) || {};
      localStorage.setItem('user', JSON.stringify({ ...currentUser, ...res.data }));

      toast.success('Profile updated!');
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not update profile.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <><Header /><div className="p-5 text-muted">Loading profile...</div></>;

  return (
    <>
      <Header />
      <main style={{ maxWidth: '520px', margin: '2rem auto', padding: '0 1rem' }}>
        <h4 style={{ marginBottom: '1.5rem' }}>My Profile</h4>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div>
            <label style={{ fontWeight: '500', display: 'block', marginBottom: '4px' }}>Full Name</label>
            <input
              className="form-control"
              type="text"
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            />
            {errors.full_name && <p className="error">{errors.full_name}</p>}
          </div>

          <div>
            <label style={{ fontWeight: '500', display: 'block', marginBottom: '4px' }}>Email</label>
            <input
              className="form-control"
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
            {errors.email && <p className="error">{errors.email}</p>}
          </div>

          <hr />
          <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>Leave password blank to keep current password</p>

          <div>
            <label style={{ fontWeight: '500', display: 'block', marginBottom: '4px' }}>New Password</label>
            <input
              className="form-control"
              type="password"
              placeholder="New password (optional)"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
            {errors.password && <p className="error">{errors.password}</p>}
          </div>

          <div>
            <label style={{ fontWeight: '500', display: 'block', marginBottom: '4px' }}>Confirm New Password</label>
            <input
              className="form-control"
              type="password"
              placeholder="Confirm new password"
              value={formData.confirmPassword}
              onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
            {errors.confirmPassword && <p className="error">{errors.confirmPassword}</p>}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              className="btn btn-dark"
              style={{ flex: 1 }}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </>
  );
};

export default Profile;
