import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function CommunityPage({ token }) {
  const navigate = useNavigate()
  const [isUploading, setIsUploading] = useState(false)
  const [communityList, setCommunityList] = useState([])
  const [pendingItems, setPendingItems] = useState([])
  const photoRef = useRef(null)
  
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
      alert("Please upload a photo!")
      return
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
      alert("Submission failed. Check your connection.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10 text-neutral-800 dark:text-neutral-100 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={() => navigate('/')}
          className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
        >
          ← Back to Start
        </button>
      </div>
      
      <h1 className="text-3xl md:text-4xl font-light font-serif text-center mb-8 pb-4 border-b border-neutral-300 dark:border-neutral-600">
        Community Archive
      </h1>

      {/* Submission Form */}
      <section className="bg-white dark:bg-neutral-800 p-6 rounded-xl border border-neutral-200 dark:border-neutral-700 mb-10">
        <h2 className="text-xl font-medium mb-4">Add to the Collection</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Item Name</label>
            <input 
              type="text"
              placeholder="What is this item?" 
              required 
              onChange={e => setFormData({...formData, itemName: e.target.value})} 
              value={formData.itemName}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Your Name</label>
            <input 
              type="text"
              placeholder="How should we credit you?" 
              required 
              onChange={e => setFormData({...formData, submittedBy: e.target.value})} 
              value={formData.submittedBy}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Origin</label>
            <input 
              type="text"
              placeholder="Where did you get it?" 
              onChange={e => setFormData({...formData, origin: e.target.value})} 
              value={formData.origin}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Category</label>
            <select 
              onChange={e => setFormData({...formData, category: e.target.value})} 
              value={formData.category}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="clothing">Clothing</option>
              <option value="accessory">Accessory</option>
              <option value="object">Object</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">The Story</label>
            <textarea 
              placeholder="What's the story behind this item?" 
              required 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              value={formData.description}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Photo</label>
            <input 
              type="file" 
              ref={photoRef}
              accept="image/*" 
              required 
              onChange={e => setPhotoFile(e.target.files[0])}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all"
            >
              Choose File
            </button>
            {photoFile && <span className="ml-3 text-sm text-green-600">✓ {photoFile.name}</span>}
          </div>

          <button 
            type="submit" 
            disabled={isUploading}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Submit for Review'}
          </button>
        </form>
      </section>

      {/* Admin: Pending Review */}
      {token && pendingItems.length > 0 && (
        <section className="border-2 border-green-500 rounded-xl p-6 mb-10 bg-green-50 dark:bg-green-900/20">
          <h2 className="text-xl font-medium text-green-700 dark:text-green-400 mb-4">Admin: Pending Review</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingItems.map(item => (
              <div key={item.id} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                <img 
                  src={item.mainPhoto} 
                  alt={item.itemName}
                  className="w-full h-36 object-cover rounded-lg mb-3"
                />
                <h4 className="font-medium mb-1">{item.itemName}</h4>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">By: {item.submittedBy}</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleApprove(item.id)}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The Archive */}
      <section>
        <h2 className="text-2xl font-light text-center mb-6">The Archive</h2>
        
        {communityList.length === 0 ? (
          <p className="text-center text-neutral-500 dark:text-neutral-400">No items in the archive yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {communityList.map(item => (
              <div 
                key={item.id} 
                className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 relative"
              >
                {/* Admin delete button */}
                {token && (
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="absolute top-3 right-3 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-all"
                  >
                    Delete
                  </button>
                )}
                
                <img 
                  src={item.mainPhoto} 
                  alt={item.itemName}
                  className="w-full h-56 object-cover rounded-lg mb-4"
                />
                
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="font-medium text-lg">{item.itemName}</h3>
                  {item.subcategory && (
                    <span className="text-xs uppercase bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
                      {item.subcategory}
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">
                  {item.description}
                </p>
                
                <hr className="border-neutral-200 dark:border-neutral-700 mb-3" />
                
                <div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
                  <span>From: {item.origin || '—'}</span>
                  <span className="font-medium">— {item.submittedBy}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default CommunityPage