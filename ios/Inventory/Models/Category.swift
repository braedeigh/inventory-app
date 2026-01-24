import Foundation

struct Category: Codable, Identifiable, Equatable, Hashable {
    let id: String
    let name: String
    let displayName: String
    var gridCol: Int?
    var gridRow: Int?
    var boxWidth: Int?
    var boxHeight: Int?

    var slug: String {
        name
    }
}
