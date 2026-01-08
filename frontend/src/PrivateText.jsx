import './PrivateText.css'

function PrivateText({ text, isAuthenticated, isAdmin }) {
  if (!text) return null

  // Only admin can see private || text || sections
  // Friends and logged-out users see blurred content
  const canSeePrivate = isAdmin === true

  // Parse text for ||private|| sections
  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const startIndex = remaining.indexOf('||')

    if (startIndex === -1) {
      // No more private sections
      parts.push({ type: 'public', content: remaining, key: key++ })
      break
    }

    // Add public text before the private section
    if (startIndex > 0) {
      parts.push({ type: 'public', content: remaining.slice(0, startIndex), key: key++ })
    }

    // Find the closing ||
    const afterStart = remaining.slice(startIndex + 2)
    const endIndex = afterStart.indexOf('||')

    if (endIndex === -1) {
      // No closing ||, treat rest as public
      parts.push({ type: 'public', content: remaining.slice(startIndex), key: key++ })
      break
    }

    // Extract private content
    const privateContent = afterStart.slice(0, endIndex)
    parts.push({ type: 'private', content: privateContent, key: key++ })

    // Continue with remaining text
    remaining = afterStart.slice(endIndex + 2)
  }

  return (
    <span className="private-text-container">
      {parts.map(part => {
        if (part.type === 'public') {
          return <span key={part.key}>{part.content}</span>
        } else {
          // Private section - only admin can see
          if (canSeePrivate) {
            return (
              <span key={part.key} className="private-text-revealed">
                {part.content}
              </span>
            )
          } else {
            return (
              <span key={part.key} className="private-text-blurred">
                {part.content}
              </span>
            )
          }
        }
      })}
    </span>
  )
}

export default PrivateText
