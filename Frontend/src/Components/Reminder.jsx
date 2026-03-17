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

      <main className='remindermain'>
        <div className='remindermaindiv1'>
          <div>
            <h5>Reminders</h5>
            <p>{reminders.length} reminder{reminders.length !== 1 ? 's' : ''} scheduled</p>
          </div>
          <button className='btnr' onClick={() => setShowForm(!showForm)}>
            <i className="bi bi-plus"></i>Add Reminder
          </button>
        </div>

        {/* Add Reminder Form */}
        {showForm && (
          <div className="reminderform" style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  style={{ width: '180px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="What do you need to remember?"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <button className='btnr' onClick={handleAdd} disabled={creating}>
                {creating ? 'Saving...' : 'Save'}
              </button>
              <button className='btnr' style={{ background: '#6c757d' }} onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="searchdiv">
          <input
            type="search"
            placeholder="Search..."
            className='form-control search'
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <table className='remindertable'>
          <thead>
            <tr>
              <th>Day</th>
              <th>Month</th>
              <th>Year</th>
              <th className='reminder'>Reminder</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="5" style={{ textAlign: 'center', color: '#888' }}>Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', color: '#888' }}>No reminders yet.</td></tr>
            )}
            {filtered.map(r => {
              const { day, month, year } = formatDate(r.remind_date);
              return (
                <tr key={r.id}>
                  <td>{day}</td>
                  <td>{month}</td>
                  <td>{year}</td>
                  <td className='remindertd'>
                    <ul>
                      {r.notes.split('\n').map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <i
                      className="bi bi-trash tabletrash"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleDelete(r.id)}
                    ></i>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>
    </>
  );
};

export default Reminder;