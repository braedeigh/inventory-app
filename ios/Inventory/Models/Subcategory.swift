import Foundation

struct Subcategory: Codable, Identifiable, Equatable, Hashable {
    let id: String
    let name: String
    let displayName: String
    let category: String
}
