import PrivateText from '../PrivateText.jsx'

function ItemCard({
  item,
  index,
  isAdmin,
  token,
  confirmDelete,
  setConfirmDelete,
  onDelete,
  onNavigate
}) {
  const isPrivateItem = item.private === 'true' || item.private === true
  const shouldBlur = isPrivateItem && !isAdmin
  const shouldBlurPhotos = ((item.private === 'true' || item.private === true) || (item.privatePhotos === 'true' || item.privatePhotos === true)) && !isAdmin
  const shouldBlurDescription = ((item.private === 'true' || item.private === true) || (item.privateDescription === 'true' || item.privateDescription === true)) && !isAdmin
  const shouldBlurOrigin = ((item.private === 'true' || item.private === true) || (item.privateOrigin === 'true' || item.privateOrigin === true)) && !isAdmin

  return (
    <div
      key={index}
      className={`bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 ${shouldBlur ? 'opacity-60' : 'cursor-pointer'}`}
      onClick={() => !shouldBlur && onNavigate(item.id)}
    >
      {item.mainPhoto && (
        <img src={item.mainPhoto} alt={item.itemName} className={`w-full max-w-[200px] h-auto rounded-lg mb-3 ${shouldBlurPhotos ? 'blur-lg' : ''}`} />
      )}
      <div className={`mb-2 ${shouldBlur ? 'blur-sm' : ''}`}>
        <strong className="text-neutral-500 dark:text-neutral-400">Name:</strong> {shouldBlur ? 'Private Item' : item.itemName}
      </div>
      <div className={`mb-2 ${shouldBlurDescription ? 'blur-sm' : ''}`}>
        <strong className="text-neutral-500 dark:text-neutral-400">Description:</strong> {shouldBlurDescription ? '••••••••••••••••' : <PrivateText text={item.description} isAuthenticated={!!token} isAdmin={isAdmin} />}
      </div>
      <div className={`mb-2 ${shouldBlur ? 'blur-sm' : ''}`}>
        <strong className="text-neutral-500 dark:text-neutral-400">Category:</strong> {shouldBlur ? '••••••' : item.category}
      </div>
      <div className={`mb-2 ${shouldBlurOrigin ? 'blur-sm' : ''}`}>
        <strong className="text-neutral-500 dark:text-neutral-400">Origin:</strong> {shouldBlurOrigin ? '••••••' : item.origin}
      </div>

      {isAdmin && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          {confirmDelete === item.id ? (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-500 rounded-lg">
              <p className="text-sm text-center mb-2">Delete this item?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onDelete(item.id)
                    setConfirmDelete(null)
                  }}
                  className="flex-1 py-2 text-base bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2 text-base bg-neutral-300 dark:bg-neutral-600 rounded-lg hover:bg-neutral-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate(item.id, true)}
                className="flex-1 py-2 text-base bg-blue-200 text-black rounded-lg hover:bg-blue-300 transition-all"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDelete(item.id)}
                className="flex-1 py-2 text-base bg-red-200 text-black rounded-lg hover:bg-red-300 transition-all"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ItemCard
