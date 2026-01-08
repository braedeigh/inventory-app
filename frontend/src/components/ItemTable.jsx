import PrivateText from '../PrivateText.jsx'

function ItemTable({
  items,
  isAdmin,
  token,
  editingIndex,
  editForm,
  setEditForm,
  onNavigate,
  onDelete
}) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-green-600 text-white">
            <th className="p-3 text-left w-18">Photo</th>
            <th className="p-3 text-left w-1/6">Item Name</th>
            <th className="p-3 text-left">Description</th>
            <th className="p-3 text-left w-1/6">Origin</th>
            {isAdmin && <th className="p-3 text-left w-38">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const isPrivateItem = item.private === 'true' || item.private === true
            const shouldBlur = isPrivateItem && !isAdmin
            const shouldBlurPhotos = ((item.private === 'true' || item.private === true) || (item.privatePhotos === 'true' || item.privatePhotos === true)) && !isAdmin
            const shouldBlurDescription = ((item.private === 'true' || item.private === true) || (item.privateDescription === 'true' || item.privateDescription === true)) && !isAdmin
            const shouldBlurOrigin = ((item.private === 'true' || item.private === true) || (item.privateOrigin === 'true' || item.privateOrigin === true)) && !isAdmin

            return (
              <tr
                key={index}
                onClick={() => {
                  if (editingIndex !== index && !shouldBlur) {
                    onNavigate(item.id)
                  }
                }}
                className={`border-b border-neutral-200 dark:border-neutral-700 ${shouldBlur ? 'opacity-60' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer'}`}
              >
                <td className="p-3 w-16" onClick={(e) => e.stopPropagation()}>
                  {item.mainPhoto ? (
                    <img src={item.mainPhoto} alt={item.itemName} className={`w-12 h-12 object-cover rounded ${shouldBlurPhotos ? 'blur-md' : ''}`} />
                  ) : (
                    <div className={`w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded flex items-center justify-center text-neutral-400 ${shouldBlurPhotos ? 'blur-sm' : ''}`}>+</div>
                  )}
                </td>

                <td className="p-3">
                  {editingIndex === index ? (
                    <input
                      value={editForm.itemName}
                      onChange={(e) => setEditForm({...editForm, itemName: e.target.value})}
                      className="px-2 py-1 border rounded bg-white dark:bg-neutral-900"
                    />
                  ) : (
                    <span className={`block truncate ${shouldBlur ? 'blur-sm' : ''}`}>
                      {shouldBlur ? 'Private Item' : item.itemName}
                    </span>
                  )}
                </td>

                <td className="p-3">
                  {editingIndex === index ? (
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                      className="px-2 py-1 border rounded bg-white dark:bg-neutral-900 w-full"
                    />
                  ) : (
                    <span className={`block truncate ${shouldBlurDescription ? 'blur-sm' : ''}`}>
                      {shouldBlurDescription ? '••••••••••••••••' : <PrivateText text={item.description} isAuthenticated={!!token} isAdmin={isAdmin} />}
                    </span>
                  )}
                </td>

                <td className="p-3">
                  {editingIndex === index ? (
                    <input
                      value={editForm.origin}
                      onChange={(e) => setEditForm({...editForm, origin: e.target.value})}
                      className="px-2 py-1 border rounded bg-white dark:bg-neutral-900"
                    />
                  ) : (
                    <span className={`block truncate ${shouldBlurOrigin ? 'blur-sm' : ''}`}>
                      {shouldBlurOrigin ? '••••••' : item.origin}
                    </span>
                  )}
                </td>

                {isAdmin && (
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onNavigate(item.id, true)
                        }}
                        className="px-3 py-1 text-sm bg-blue-200 text-black rounded hover:bg-blue-400 transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(item.id)
                        }}
                        className="px-3 py-1 text-sm bg-red-200 text-black rounded hover:bg-red-400 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ItemTable
