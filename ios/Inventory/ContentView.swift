import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authService: AuthService
    @State private var selectedTab = 0

    var body: some View {
        Group {
            if authService.isAuthenticated {
                TabView(selection: $selectedTab) {
                    InventoryListView(authService: authService)
                        .tabItem {
                            Label("Inventory", systemImage: "cube.box.fill")
                        }
                        .tag(0)

                    CommunityView(authService: authService)
                        .tabItem {
                            Label("Community", systemImage: "person.3.fill")
                        }
                        .tag(1)
                }
            } else {
                LoginView(authService: authService)
            }
        }
        .animation(.easeInOut, value: authService.isAuthenticated)
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthService.shared)
}
