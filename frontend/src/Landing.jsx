import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PrivateText from './PrivateText.jsx'

function Landing({ list, communityList, token, setShowLogin, handleLogout }) {
  const [randomMyItem, setRandomMyItem] = useState(null)
  const [randomCommunityItem, setRandomCommunityItem] = useState(null)
  const [myItemQueue, setMyItemQueue] = useState([])
  const [communityQueue, setCommunityQueue] = useState([])
  const navigate = useNavigate()
  const [myItemIndex, setMyItemIndex] = useState(1)
  const [communityItemIndex, setCommunityItemIndex] = useState(1)

  const refreshMyItem = () => {
    if (!list || list.length === 0) return

    let queue = myItemQueue
    let isReshuffle = queue.length === 0

    if (isReshuffle) {
      queue = [...list].sort(() => Math.random() - 0.5)
    }

    const [next, ...rest] = queue
    setRandomMyItem(next)
    setMyItemQueue(rest)

    if (isReshuffle) {
      setMyItemIndex(1)
    } else {
      setMyItemIndex(prev => prev + 1)
    }
  }

  useEffect(() => {
    if (list.length > 0 && !randomMyItem) {
      refreshMyItem()
    }
  }, [list])

  useEffect(() => {
    if (communityList.length > 0 && !randomCommunityItem) {
      refreshCommunityItem()
    }
  }, [communityList])

  const refreshCommunityItem = () => {
    if (!communityList || communityList.length === 0) return

    let queue = communityQueue
    let isReshuffle = queue.length === 0

    if (isReshuffle) {
      queue = [...communityList].sort(() => Math.random() - 0.5)
    }

    const [next, ...rest] = queue
    setRandomCommunityItem(next)
    setCommunityQueue(rest)

    if (isReshuffle) {
      setCommunityItemIndex(1)
    } else {
      setCommunityItemIndex(prev => prev + 1)
    }
  }

  const CardContent = ({ item }) => (
    <div className="text-left">
      {item.mainPhoto && (
        <img
          src={item.mainPhoto}
          alt={item.itemName}
          className="w-full h-auto max-h-72 object-contain rounded-2xl mb-4"
        />
      )}
      <h4 className="text-xl font-normal text-neutral-800 dark:text-neutral-100 mb-2 font-serif">
        {item.itemName}
      </h4>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-3">
        <PrivateText text={item.description} isAuthenticated={!!token} />
      </p>
<p className="text-xs text-neutral-500">
  <span className="text-neutral-600 dark:text-neutral-400">Origin:</span> {item.origin}
</p>
    </div>
  )

  return (
    <div className="min-h-screen px-4 py-6 md:px-6 md:py-10 font-sans text-neutral-900 dark:text-neutral-100">
      
      {/* Header with login */}
      <div className="mb-6 md:mb-8">
        <div className="flex justify-center items-center gap-4">
          <h1 className="text-3xl md:text-4xl font-light text-neutral-800 dark:text-neutral-100 tracking-tight font-serif">
            Bradie's Show & Tell
          </h1>
          {token ? (
            <button
              onClick={handleLogout}
              className="px-5 py-2 text-sm text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-all duration-300"
            >
              Logout
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="px-5 py-2 text-sm text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-all duration-300"
            >
              Login
            </button>
          )}
        </div>
        <p className="text-neutral-500 text-sm md:text-base max-w-lg mx-auto mb-2 text-center mt-3">
          A performance art piece documenting personal belongings. Here you will find my personal inventory of every item that I own (in progress). I have also created a community show and tell project, and would love for others to contribute their favorite items!
        </p>
        <p className="text-green-700 dark:text-green-600 text-xs italic text-center">
          Click a card to shuffle
        </p>
      </div>

      {/* Cards */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 justify-center items-stretch">
        
        {/* My Inventory Card */}
        <div
          onClick={refreshMyItem}
          className="w-full md:w-[380px] mx-auto md:mx-0 bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-3xl p-6 cursor-pointer hover:scale-[1.02] hover:border-green-400 dark:hover:border-green-800/40 hover:shadow-xl dark:hover:shadow-2xl hover:shadow-green-200/50 dark:hover:shadow-green-900/20 transition-all duration-300"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold uppercase tracking-[0.2em] text-green-700 dark:text-green-600">
              My Inventory
            </h3>
            <span className="text-xs text-neutral-400 dark:text-neutral-600">
              {list.findIndex(item => item.id === randomMyItem?.id) + 1} / {list.length}
            </span>
          </div>
          
          <p className="text-xs text-neutral-400 dark:text-neutral-600 text-center mb-4">↻ click to shuffle</p>
          
          {randomMyItem ? (
            <CardContent item={randomMyItem} />
          ) : (
            <div className="h-48 flex items-center justify-center text-neutral-400 dark:text-neutral-600 italic">
              Loading...
            </div>
          )}
          
<button
  onClick={(e) => { e.stopPropagation(); navigate('/inventory'); }}
  style={{
    width: '100%',
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#15803d',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  }}
  onMouseOver={(e) => e.target.style.backgroundColor = '#166534'}
  onMouseOut={(e) => e.target.style.backgroundColor = '#15803d'}
>
  View Full Inventory
</button>
        </div>

        {/* Community Card */}
        <div
          onClick={refreshCommunityItem}
          className="w-full md:w-[380px] mx-auto md:mx-0 bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-3xl p-6 cursor-pointer hover:scale-[1.02] hover:border-amber-400 dark:hover:border-amber-800/40 hover:shadow-xl dark:hover:shadow-2xl hover:shadow-amber-200/50 dark:hover:shadow-amber-900/20 transition-all duration-300"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-600">
             Show & Tell
            </h3>
            <span className="text-xs text-neutral-400 dark:text-neutral-600">
              {communityList.findIndex(item => item.id === randomCommunityItem?.id) + 1} / {communityList.length}
            </span>
          </div>
          
          <p className="text-xs text-neutral-400 dark:text-neutral-600 text-center mb-4">↻ click to shuffle</p>
          
          {randomCommunityItem ? (
            <CardContent item={randomCommunityItem} />
          ) : (
            <div className="h-48 flex items-center justify-center text-neutral-400 dark:text-neutral-600 italic">
              {communityList && communityList.length === 0 ? "No community items yet" : "Loading..."}
            </div>
          )}
          
<button
  onClick={(e) => { e.stopPropagation(); navigate('/community'); }}
  style={{
    width: '100%',
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#b45309',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  }}
  onMouseOver={(e) => e.target.style.backgroundColor = '#92400e'}
  onMouseOut={(e) => e.target.style.backgroundColor = '#b45309'}
>
  Explore Community Archive
</button>
        </div>
      </div>
    </div>
  )
}

export default Landing