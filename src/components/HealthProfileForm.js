// HealthProfileForm - user sets their health profile (diet, allergies, conditions, goals)
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function HealthProfileForm({ value, onSave }) {
  const normalize = (raw) => {
    if (!raw) {
      return {
        diet: '',
        allergies: '',
        conditions: '',
        goals: ''
      }
    }
    const toLine = (entry) => {
      if (Array.isArray(entry)) return entry.join(', ')
      return entry ?? ''
    }
    return {
      diet: raw.diet ?? raw.diet_type ?? '',
      allergies: toLine(raw.allergies),
      conditions: toLine(raw.conditions),
      goals: toLine(raw.goals)
    }
  }

  const [profile, setProfile] = useState(normalize(value))
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const { getAccessToken, refreshProfile } = useAuth()

  useEffect(() => {
    if (value) setProfile(normalize(value))
  }, [value])

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const token = await getAccessToken()
      if (!token) {
        setError('Please sign in again to update your profile.')
        return
      }
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      })
      if (res.ok) {
        const json = await res.json()
  const saved = normalize(json.profile || profile)
  setProfile(saved)
        setSuccess(true)
        await refreshProfile()
        onSave && onSave(saved)
      } else {
        const json = await res.json()
        setError(json.error || 'Error saving profile')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl shadow p-6 max-w-lg mx-auto mt-8">
      <h2 className="text-xl font-bold mb-2">Your Health Profile</h2>
      <div>
        <label className="block text-sm font-semibold mb-1">Diet Type</label>
        <input name="diet" value={profile.diet} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g. Vegetarian, Keto, Balanced" />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Allergies</label>
        <input name="allergies" value={profile.allergies} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g. nuts, dairy, gluten" />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Medical Conditions</label>
        <input name="conditions" value={profile.conditions} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g. diabetes, hypertension" />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Health Goals</label>
        <input name="goals" value={profile.goals} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g. weight loss, muscle gain" />
      </div>
      <button type="submit" disabled={saving} className="w-full py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold rounded-lg hover:from-green-600 hover:to-blue-600 transition-all">
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
      {success && <div className="text-green-700 mt-2">Profile saved!</div>}
      {error && <div className="text-red-600 mt-2">{error}</div>}
    </form>
  )
}
