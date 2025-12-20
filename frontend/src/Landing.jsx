import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PrivateText from './PrivateText.jsx'

function Landing({ list, communityList, token, setShowLogin, handleLogout }) {
  const [randomMyItem, setRandomMyItem] = useState(null)
  const [randomCommunityItem, setRandomCommunityItem] = useState(null)
  const navigate = useNavigate()

const refreshMyItem = () => {
  if (list && list.length > 0) {
    const available = list.filter(item => item.id !== randomMyItem?.id)
    const pool = available.length > 0 ? available : list
    const randomIndex = Math.floor(Math.random() * pool.length)
    setRandomMyItem(pool[randomIndex])
  }
}

const refreshCommunityItem = () => {
  if (communityList && communityList.length > 0) {
    const available = communityList.filter(item => item.id !== randomCommunityItem?.id)
    const pool = available.length > 0 ? available : communityList
    const randomIndex = Math.floor(Math.random() * pool.length)
    setRandomCommunityItem(pool[randomIndex])
  }
}

  useEffect(() => {
    refreshMyItem()
    refreshCommunityItem()
  }, [list, communityList])

  // Helper component - fully dynamic: photo aspect ratio + description length
  const CardContent = ({ item }) => (
    <div style={{ textAlign: 'left', marginTop: '10px' }}>
      {item.mainPhoto && (
        <img 
          src={item.mainPhoto} 
          alt={item.itemName} 
          style={{ 
            width: '100%', 
            height: 'auto',
            maxHeight: '400px',
            objectFit: 'contain',
            borderRadius: '8px' 
          }} 
        />
      )}
      <h4 style={{ margin: '10px 0 5px 0' }}>{item.itemName}</h4>
      
      <p style={{ 
        fontSize: '0.85em', 
        color: '#666',
        margin: '0 0 10px 0',
        lineHeight: '1.5'
      }}>
        <PrivateText text={item.description} isAuthenticated={!!token} />
      </p>

      <p style={{ fontSize: '0.9em', margin: '0', color: '#555' }}>
        <strong>Origin:</strong> {item.origin}
      </p>
    </div>
  )

  return (
    <div className="landing-container" style={{ padding: '20px', textAlign: 'center' }}>
      {/* Header with login button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ width: '80px' }}></div>
        <h1 style={{ margin: 0 }}>Bradie's Show and Tell</h1>
        <div style={{ width: '80px' }}>
          {token ? (
            <button onClick={handleLogout} style={{ padding: '8px 16px' }}>Logout</button>
          ) : (
            <button onClick={() => setShowLogin(true)} style={{ padding: '8px 16px' }}>Login</button>
          )}
        </div>
      </div>

      <p style={{ maxWidth: '600px', margin: '0 auto 10px' }}>
        This is a performance art piece documenting my personal 
        belongings.
        Here you can explore my inventory or see what others are sharing.
      </p>

      <p style={{ marginBottom: '20px', fontSize: '0.9em', color: '#4CAF50', fontWeight: 'bold' }}>
        Click an item to view a new random item
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Personal Inventory Preview Card */}
        <div 
          className="preview-card" 
          onClick={refreshMyItem} 
          style={{ 
            cursor: 'pointer', border: '1px solid #4CAF50', padding: '20px', 
            borderRadius: '12px', width: '320px', backgroundColor: '#fff', color: '#333' 
          }}
        >
          <h3>My Inventory</h3>
          {randomMyItem ? <CardContent item={randomMyItem} /> : <div>Loading...</div>}
          <button 
            onClick={(e) => { e.stopPropagation(); navigate('/inventory'); }}
            style={{ marginTop: '15px', width: '100%' }}
          >
            View Full Inventory
          </button>
        </div>

        {/* Community Preview Card */}
        <div 
          className="preview-card" 
          onClick={refreshCommunityItem} 
          style={{ 
            cursor: 'pointer', border: '1px solid #4CAF50', padding: '20px', 
            borderRadius: '12px', width: '320px', backgroundColor: '#fff', color: '#333' 
          }}
        >
          <h3>Community Show & Tell</h3>
          {randomCommunityItem ? <CardContent item={randomCommunityItem} /> : (
            <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {communityList && communityList.length === 0 ? "No community items yet" : "Loading..."}
            </div>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); navigate('/community'); }}
            style={{ marginTop: '15px', width: '100%' }}
          >
            Explore Community
          </button>
        </div>
      </div>
    </div>
  )
}

export default Landing