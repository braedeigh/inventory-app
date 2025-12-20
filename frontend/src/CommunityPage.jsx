import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function CommunityPage({ token }) {
  const navigate = useNavigate()
  const [isUploading, setIsUploading] = useState(false)
  const [communityList, setCommunityList] = useState([])
  const [pendingItems, setPendingItems] = useState([])
  
  const [formData, setFormData] = useState({
    itemName: '', 
    description: '', 
    category: 'clothing', 
    subcategory: '',
    origin: '', 
    submittedBy: ''
  })
  const [photoFile, setPhotoFile] = useState(null)

  const fetchPublicItems = async () => {
    try {
      const res = await fetch(`${API_URL}/community`)
      const data = await res.json()
      setCommunityList(data)
    } catch (err) { console.error(err) }
  }

  const fetchPendingItems = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/community/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setPendingItems(data)
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    fetchPublicItems()
    fetchPendingItems()
  }, [token])

  const handleApprove = async (id) => {
    await fetch(`${API_URL}/community/${id}/approve`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    fetchPublicItems()
    fetchPendingItems()
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this item?")) return
    await fetch(`${API_URL}/community/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    fetchPublicItems()
    fetchPendingItems()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!photoFile) {
        alert("Please upload a photo!");
        return;
    }
    setIsUploading(true)
    
    const data = new FormData()
    data.append('id', crypto.randomUUID())
    data.append('itemName', formData.itemName)
    data.append('description', formData.description)
    data.append('category', formData.category)
    data.append('subcategory', formData.subcategory)
    data.append('origin', formData.origin)
    data.append('submittedBy', formData.submittedBy)
    data.append('photo', photoFile)

    try {
        const res = await fetch(`${API_URL}/community`, { method: 'POST', body: data })
        if (res.ok) {
          alert("Success! Your item has been sent to Bradie for review.")
          setFormData({ itemName: '', description: '', category: 'clothing', subcategory: '', origin: '', submittedBy: '' })
          setPhotoFile(null)
          fetchPendingItems() 
        }
    } catch (err) {
        alert("Submission failed. Check your connection.");
    } finally {
        setIsUploading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'monospace' }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: '20px', cursor: 'pointer' }}>
        ← Back to Start
      </button>
      
      <h1 style={{ textAlign: 'center', borderBottom: '1px solid black', paddingBottom: '10px' }}>
        COMMUNITY ARCHIVE
      </h1>

      {/* --- DETAILED SUBMISSION FORM --- */}
      <section style={{ background: '#f9f9f9', padding: '25px', border: '1px solid #ddd', marginBottom: '40px' }}>
        <h2 style={{ marginTop: 0 }}>Add to the Collection</h2>
<form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
  <input placeholder="Item Name" required onChange={e => setFormData({...formData, itemName: e.target.value})} value={formData.itemName} />
  <input placeholder="Your Name" required onChange={e => setFormData({...formData, submittedBy: e.target.value})} value={formData.submittedBy} />
  <input placeholder="Origin (Where did you get it?)" onChange={e => setFormData({...formData, origin: e.target.value})} value={formData.origin} />
  
  <select onChange={e => setFormData({...formData, category: e.target.value})} value={formData.category}>
            <option value="clothing">Clothing</option>
            <option value="imaginary">Accessory</option>
            <option value="object">Object</option>
            <option value="other">Other</option>
          </select>

          <textarea style={{ gridColumn: 'span 2', height: '80px' }} placeholder="The story behind this item..." required onChange={e => setFormData({...formData, description: e.target.value})} value={formData.description} />
          
<div style={{ gridColumn: 'span 2', color: '#333' }}>
  <label>Upload Photo: </label>
  <input type="file" accept="image/*" required onChange={e => setPhotoFile(e.target.files[0])} />
  {photoFile && <span style={{ marginLeft: '10px' }}>✓ {photoFile.name}</span>}
</div>
          <button type="submit" disabled={isUploading} style={{ gridColumn: 'span 2', padding: '10px', background: 'black', color: 'white', cursor: 'pointer' }}>
            {isUploading ? 'UPLOADING...' : 'SUBMIT FOR REVIEW'}
          </button>
        </form>
      </section>

      {/* --- ADMIN MODERATION SECTION --- */}
      {token && pendingItems.length > 0 && (
        <section style={{ border: '2px solid #4CAF50', padding: '20px', marginBottom: '40px', background: '#e8f5e9' }}>
          <h2 style={{ color: '#2e7d32', marginTop: 0 }}>Admin: Pending Review</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
            {pendingItems.map(item => (
              <div key={item.id} style={{ border: '1px solid #999', padding: '10px', background: 'white' }}>
                <img src={item.mainPhoto} style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                <h4 style={{ margin: '10px 0' }}>{item.itemName}</h4>
                <p style={{ fontSize: '0.8rem' }}>By: {item.submittedBy}</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleApprove(item.id)} style={{ flex: 1, background: '#4CAF50', color: 'white', border: 'none', padding: '5px' }}>Approve</button>
                    <button onClick={() => handleDelete(item.id)} style={{ flex: 1, background: '#f44336', color: 'white', border: 'none', padding: '5px' }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- PUBLIC FEED --- */}
      <section>
        <h2 style={{ textAlign: 'center' }}>The Archive</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
          {communityList.length === 0 ? <p style={{ textAlign: 'center', gridColumn: 'span 3' }}>No items in the archive yet.</p> : communityList.map(item => (
            <div key={item.id} style={{ border: '1px solid #000', padding: '15px', position: 'relative' }}>
              {/* Admin delete button for approved items */}
              {token && (
                <button 
                  onClick={() => handleDelete(item.id)}
                  style={{ 
                    position: 'absolute', 
                    top: '10px', 
                    right: '10px', 
                    background: '#f44336', 
                    color: 'white', 
                    border: 'none', 
                    padding: '5px 10px',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Delete
                </button>
              )}
              <img src={item.mainPhoto} style={{ width: '100%', height: '250px', objectFit: 'cover', marginBottom: '10px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ margin: 0 }}>{item.itemName}</h3>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', background: '#eee', padding: '2px 5px' }}>{item.subcategory}</span>
              </div>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{item.description}</p>
              <hr />
              <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>From: {item.origin}</span>
                <span style={{ fontWeight: 'bold' }}>— {item.submittedBy}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default CommunityPage