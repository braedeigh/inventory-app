import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function CommunityPage({ token, setShowLogin, handleLogout }) {
  const navigate = useNavigate()
  const [isUploading, setIsUploading] = useState(false)
  const [communityList, setCommunityList] = useState([])
  const [pendingItems, setPendingItems] = useState([])
  const photoRef = useRef(null)

  // Refs for Enter key navigation
  const itemNameRef = useRef(null)
  const submittedByRef = useRef(null)
  const originRef = useRef(null)
  const descriptionRef = useRef(null)
  const submitRef = useRef(null)

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  
  const [formData, setFormData] = useState({
    itemName: '', 
    description: '', 
    origin: '', 
    submittedBy: ''
  })
  const [photoFile, setPhotoFile] = useState(null)
  
  const [errors, setErrors] = useState({
    itemName: false,
    submittedBy: false,
    origin: false,
    description: false,
    photo: false
  })

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
    
    const newErrors = {
      itemName: formData.itemName === '',
      submittedBy: formData.submittedBy === '',
      origin: formData.origin === '',
      description: formData.description === '',
      photo: !photoFile
    }
    
    setErrors(newErrors)
    
    if (Object.values(newErrors).some(error => error)) {
      return
    }
    
    setIsUploading(true)
    
    const data = new FormData()
    data.append('id', crypto.randomUUID())
    data.append('itemName', formData.itemName)
    data.append('description', formData.description)
    data.append('origin', formData.origin)
    data.append('submittedBy', formData.submittedBy)
    data.append('photo', photoFile)

    try {
      const res = await fetch(`${API_URL}/community`, { method: 'POST', body: data })
      if (res.ok) {
        alert("Success! Your item has been sent to Bradie for review.")
        setFormData({ itemName: '', description: '', origin: '', submittedBy: '' })
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
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10 pb-[50vh] md:pb-10 text-neutral-800 dark:text-neutral-100 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
        >
          ← Home
        </button>
        {token ? (
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
          >
            Logout
          </button>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
          >
            Login
          </button>
        )}
      </div>

      <h1 className="text-3xl md:text-4xl font-light font-serif text-center mb-8">
        Community Archive
      </h1>

      {/* Submission Form */}
      <section className="bg-white dark:bg-neutral-800 p-4 md:p-6 rounded-none md:rounded-xl border-y md:border border-neutral-200 dark:border-neutral-700 mb-10 -mx-4 md:mx-0 px-4 md:px-6">
        <h2 className="text-xl font-medium mb-4">Add to the Collection</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Item Name</label>
            <input
              type="text"
              ref={itemNameRef}
              placeholder="What is this item?"
              onChange={e => {
                setFormData({...formData, itemName: e.target.value})
                setErrors({...errors, itemName: false})
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submittedByRef.current?.focus()
                }
              }}
              value={formData.itemName}
              className={`w-full px-3 py-3 md:py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.itemName ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'}`}
            />
            {errors.itemName && <span className="text-red-500 text-xs">Required</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Your Name</label>
            <input
              type="text"
              ref={submittedByRef}
              placeholder="How should we credit you?"
              onChange={e => {
                setFormData({...formData, submittedBy: e.target.value})
                setErrors({...errors, submittedBy: false})
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  originRef.current?.focus()
                }
              }}
              value={formData.submittedBy}
              className={`w-full px-3 py-3 md:py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.submittedBy ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'}`}
            />
            {errors.submittedBy && <span className="text-red-500 text-xs">Required</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Origin</label>
            <input
              type="text"
              ref={originRef}
              placeholder="Where did you get it?"
              onChange={e => {
                setFormData({...formData, origin: e.target.value})
                setErrors({...errors, origin: false})
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  descriptionRef.current?.focus()
                }
              }}
              value={formData.origin}
              className={`w-full px-3 py-3 md:py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.origin ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'}`}
            />
            {errors.origin && <span className="text-red-500 text-xs">Required</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">The Story</label>
            <textarea
              ref={descriptionRef}
              placeholder="What's the story behind this item?"
              onChange={e => {
                setFormData({...formData, description: e.target.value})
                setErrors({...errors, description: false})
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  photoRef.current?.click()
                }
              }}
              value={formData.description}
              className={`w-full px-3 py-3 md:py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px] ${errors.description ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'}`}
            />
            {errors.description && <span className="text-red-500 text-xs">Required</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Photo</label>
            <input
              type="file"
              ref={photoRef}
              accept="image/*"
              onChange={e => {
                setPhotoFile(e.target.files[0])
                setErrors({...errors, photo: false})
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className={`w-full md:w-auto px-4 py-3 md:py-2 text-base rounded-lg transition-all border ${errors.photo ? 'bg-red-100 dark:bg-red-900/30 border-red-500' : 'bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 border-neutral-300 dark:border-neutral-600'}`}
            >
              Choose File
            </button>
            {photoFile && <span className="block md:inline mt-2 md:mt-0 md:ml-3 text-sm text-green-600">✓ {photoFile.name}</span>}
            {errors.photo && <span className="block md:inline mt-1 md:mt-0 md:ml-3 text-red-500 text-xs">Required</span>}
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
          <p className="text-center text-neutral-500 dark:text-neutral-400">Loading...</p>
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
                
                <h3 className="font-medium text-lg mb-2">{item.itemName}</h3>
                
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">
                  {item.description}
                </p>
                
                <hr className="border-neutral-200 dark:border-neutral-700 mb-3" />
                
                <div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
                  <span>From: {item.origin || '—'}</span>
                  <span className="font-medium">by: {item.submittedBy}</span>
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