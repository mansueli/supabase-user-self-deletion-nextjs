import { useState, useEffect } from 'react'
import { useUser, useSupabaseClient, Session } from '@supabase/auth-helpers-react'
import Avatar from './Avatar'
import { Database } from '../utils/database.types'
import { useRouter } from 'next/router'
type Profiles = Database['public']['Tables']['profiles']['Row']

export default function Account({ session }: { session: Session }) {
  const supabase = useSupabaseClient<Database>()
  const user = useUser()
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState<Profiles['username']>(null)
  const [website, setWebsite] = useState<Profiles['website']>(null)
  const [avatar_url, setAvatarUrl] = useState(() => profile?.avatar_url || '');
  const [isModalOpen, setIsModalOpen] = useState(false)
  const router = useRouter()
  //  for password fields
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [profile, setProfile] = useState<Profiles | null>(null);

  useEffect(() => {
    async function getProfile() {
        try {
            setLoading(true);
            if (!user) throw new Error('No user');

            let { data, error } = await supabase
                .from('profiles')
                .select(`username, website, avatar_url, full_name, id, updated_at`)
                .eq('id', user.id)
                .single();

            if (data) {
                setProfile({
                    id: user.id,
                    updated_at: data.updated_at,
                    username: data.username,
                    full_name: data.full_name,
                    avatar_url: data.avatar_url,
                    website: data.website,
                });

                // Update the individual state variables
                setUsername(data.username);
                setWebsite(data.website);
                setAvatarUrl(data.avatar_url? data.avatar_url : '');
            }
        } catch (error) {
            alert('Error loading user data!');
            console.log(error);
        } finally {
            setLoading(false);
        }
    }

    getProfile();
}, [user]);

  
  async function deleteAccount() {
    try {
      setLoading(true)
      if (!user) throw new Error('No user')
      await supabase.functions.invoke('user-self-deletion')
      alert('Account deleted successfully!')
    } catch (error) {
      alert('Error deleting the account!')
      console.log(error)
    } finally {
      setLoading(false)
      setIsModalOpen(false)
      await supabase.auth.signOut()
      router.push('/')
    }
  }
  async function updatePassword() {
    try {
      setLoading(true)

      if (!user) throw new Error('No user')

      if (newPassword !== confirmNewPassword) {
        alert('New passwords do not match!')
        return
      }

      // Call the secure update password function
      const { data, error } = await supabase.functions.invoke('secure_update_password',{ body: {
        "oldPassword": oldPassword,
        "newPassword": newPassword
        }
      });

      if (error) throw error

      alert('Password updated!')
    } catch (error) {
      alert('Error updating the password!')
      console.log(error)
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile({
    username,
    website,
    avatar_url,
  }: {
    username: Profiles['username']
    website: Profiles['website']
    avatar_url: Profiles['avatar_url']
  }) {
    try {
      setLoading(true)
      if (!user) throw new Error('No user')

      const updates = {
        id: user.id,
        username,
        website,
        avatar_url,
        updated_at: new Date().toISOString(),
      }

      let { error } = await supabase.from('profiles').upsert(updates)
      if (error) throw error
      alert('Profile updated!')
    } catch (error) {
      alert('Error updating the data!')
      console.log(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-widget">
      <Avatar
        uid={user!.id}
        url={avatar_url}
        size={150}
        onUpload={(url) => {
          setAvatarUrl(url)
          updateProfile({ username, website, avatar_url: url })
        }}
      />
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="text" value={session.user.email} disabled />
      </div>
      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username || ''}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="website"
          value={website || ''}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div>
        <button
          className="button primary block"
          onClick={() => updateProfile({ username, website, avatar_url })}
          disabled={loading}
        >
          {loading ? 'Loading ...' : 'Update'}
        </button>
      </div>
      // Add new form to the return statement
      <div>
        <label htmlFor="old-password">Old Password</label>
        <input
          id="old-password"
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="new-password">New Password</label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="confirm-new-password">Confirm New Password</label>
        <input
          id="confirm-new-password"
          type="password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
        />
      </div>

      <div>
        <button
          className="button primary block"
          onClick={updatePassword}
          disabled={loading}
        >
          {loading ? 'Loading ...' : 'Update Password'}
        </button>
      </div>

      <div>
        <button className="button block" onClick={async () => {
          await supabase.auth.signOut()
          router.push('/')
        }}>
          Sign Out
        </button>
      </div>

      <div>
        <button className="button error block" onClick={() => setIsModalOpen(true)}>
          Delete Account
        </button>
      </div>

      {isModalOpen && (
        <div className="modal-container">
          <div className="modal-content">
            <h2>Confirm Account Deletion</h2>
            <p>Are you sure you want to delete your account?</p>
            <div>
              <button className="button error" onClick={deleteAccount}>
                Confirm
              </button>
              <button className="button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
