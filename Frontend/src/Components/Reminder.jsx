import React, { useState, useEffect } from 'react'
import Header from './Header'
import './Reminder.css'
import apiClient from '../api/apiClient'
import toast from 'react-hot-toast'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Reminder = () => {
  const [reminders, setReminders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const res = await apiClient.get('/reminders');
        setReminders(res.data);
      } catch (err) {
        console.error('Failed to fetch reminders:', err);
        toast.error('Could not load reminders.');
      } finally {
        setLoading(false);
      }
    };
    fetchReminders();
  }, []);

  const handleAdd = async () => {
    if (!newDate || !newNotes.trim()) {
      toast.error('Please fill in both date and notes.');
      return;
    }
    setCreating(true);
    try {
      const res = await apiClient.post('/reminders', {
        remind_date: newDate,
        notes: newNotes.trim(),
      });
      setReminders(prev => [...prev, res.data]);
      setNewDate('');
      setNewNotes('');
      setShowForm(false);
      toast.success('Reminder added!');
    } catch (err) {
      console.error('Failed to add reminder:', err);
      toast.error('Could not add reminder.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/reminders/${id}`);
      setReminders(prev => prev.filter(r => r.id !== id));
      toast.success('Reminder deleted.');
    } catch (err) {
      console.error('Failed to delete reminder:', err);
      toast.error('Could not delete reminder.');
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return {
      day: DAYS[d.getUTCDay()],
      month: MONTHS[d.getUTCMonth()],
      year: d.getUTCFullYear(),
    };
  };

  const filtered = reminders.filter(r =>
    r.notes.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header />

      <main className="container pt-4 pb-5" style={{ maxWidth: '1000px' }}>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
          <div>
            <h3 className="mb-1" style={{ fontWeight: '400', color: '#1a1a1a' }}>Reminders</h3>
            <p className="text-muted mb-0">{reminders.length} reminder{reminders.length !== 1 ? 's' : ''} scheduled</p>
          </div>
          <button className="btn btn-primary rounded-pill px-4 py-2 d-flex align-items-center justify-content-center border-0 shadow-sm hover-scale" 
            style={{ backgroundColor: '#1877f2', transition: 'transform 0.2s' }}
            onClick={() => setShowForm(!showForm)}>
            <i className="bi bi-plus-lg me-2"></i>Add Reminder
          </button>
        </div>

        {/* Add Reminder Form */}
        {showForm && (
          <div className="card shadow-sm border-0 bg-light rounded-4 mb-4">
            <div className="card-body p-4">
              <div className="row g-3 align-items-end">
                <div className="col-12 col-md-auto">
                  <label className="form-label fw-medium text-muted mb-1" style={{ fontSize: '0.9rem' }}>Date</label>
                  <input
                    type="date"
                    className="form-control border-0 shadow-sm"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    style={{ minWidth: '160px' }}
                  />
                </div>
                <div className="col-12 col-md">
                  <label className="form-label fw-medium text-muted mb-1" style={{ fontSize: '0.9rem' }}>Notes</label>
                  <input
                    type="text"
                    className="form-control border-0 shadow-sm"
                    placeholder="What do you need to remember?"
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  />
                </div>
                <div className="col-12 col-md-auto d-flex gap-2 mt-3 mt-md-0">
                  <button className="btn btn-dark px-4 flex-grow-1 flex-md-grow-0 shadow-sm" onClick={handleAdd} disabled={creating}>
                    {creating ? 'Saving...' : 'Save'}
                  </button>
                  <button className="btn btn-outline-secondary px-4 flex-grow-1 flex-md-grow-0 bg-white" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 d-flex justify-content-start">
          <div className="position-relative w-100" style={{ maxWidth: '400px' }}>
            <i className="bi bi-search position-absolute text-muted" style={{ top: '50%', transform: 'translateY(-50%)', left: '16px' }}></i>
            <input
              type="search"
              placeholder="Search reminders..."
              className="form-control rounded-pill py-2 border-0 shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ backgroundColor: '#f8f9fa', paddingLeft: '40px' }}
            />
          </div>
        </div>

        <div className="card shadow-sm border-0 rounded-4 overflow-hidden mb-5">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="px-4 py-3 text-muted fw-semibold border-0" style={{ minWidth: '150px' }}>Date</th>
                  <th className="px-4 py-3 text-muted fw-semibold border-0 w-100">Reminder</th>
                  <th className="px-4 py-3 text-muted fw-semibold border-0 text-center">Action</th>
                </tr>
              </thead>
              <tbody style={{ borderTop: 'none' }}>
                {loading && (
                  <tr><td colSpan="3" className="text-center py-5 text-muted">Loading...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan="3" className="text-center py-5 text-muted">No reminders yet.</td></tr>
                )}
                {filtered.map(r => {
                  const { day, month, year } = formatDate(r.remind_date);
                  const dateNum = new Date(r.remind_date).getUTCDate();
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3 text-nowrap">
                        <span className="fw-medium text-dark">{day}, {month} {dateNum}</span>
                        <div className="text-muted small">{year}</div>
                      </td>
                      <td className="px-4 py-3">
                        <ul className="mb-0 ps-3" style={{ listStyleType: 'circle' }}>
                          {r.notes.split('\n').map((line, i) => (
                            <li key={i} className="text-dark">{line}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => handleDelete(r.id)}
                          className="btn btn-sm btn-light text-danger border-0 rounded-circle"
                          style={{ width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Delete Reminder"
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
};

export default Reminder;