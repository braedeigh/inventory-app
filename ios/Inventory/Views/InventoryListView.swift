import SwiftUI

struct InventoryListView: View {
    @StateObject private var viewModel = InventoryViewModel()
    @ObservedObject var authService: AuthService

    @State private var showingFilters = false
    @State private var showingAddItem = false

    private let columns = [
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16)
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                if viewModel.isLoading && viewModel.items.isEmpty {
                    ProgressView("Loading inventory...")
                } else if viewModel.items.isEmpty {
                    emptyStateView
                } else {
                    itemsGrid
                }
            }
            .navigationTitle("Inventory")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button(role: .destructive) {
                            authService.logout()
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "person.circle")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 16) {
                        Button {
                            showingFilters = true
                        } label: {
                            Image(systemName: viewModel.filterState.hasActiveFilters ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                        }

                        if authService.isAdmin {
                            Button {
                                showingAddItem = true
                            } label: {
                                Image(systemName: "plus")
                            }
                        }
                    }
                }
            }
            .searchable(text: $viewModel.filterState.searchText, prompt: "Search items...")
            .refreshable {
                await viewModel.refreshItems()
            }
            .sheet(isPresented: $showingFilters) {
                FilterView(
                    filterState: $viewModel.filterState,
                    categories: viewModel.categories,
                    subcategories: viewModel.subcategoriesForSelectedCategory,
                    materials: viewModel.materials
                )
            }
            .sheet(isPresented: $showingAddItem) {
                ItemFormView(
                    viewModel: viewModel,
                    isPresented: $showingAddItem
                )
            }
            .task {
                await viewModel.loadAllData()
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.errorMessage = nil
                }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    private var itemsGrid: some View {
        ScrollView {
            // Stats bar
            HStack {
                Text("\(viewModel.filteredItems.count) items")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Spacer()

                Menu {
                    ForEach(SortOption.allCases, id: \.self) { option in
                        Button {
                            viewModel.filterState.sortOption = option
                        } label: {
                            HStack {
                                Text(option.displayName)
                                if viewModel.filterState.sortOption == option {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(viewModel.filterState.sortOption.displayName)
                        Image(systemName: "chevron.down")
                    }
                    .font(.subheadline)
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)

            LazyVGrid(columns: columns, spacing: 16) {
                ForEach(viewModel.filteredItems) { item in
                    NavigationLink {
                        ItemDetailView(item: item, viewModel: viewModel, authService: authService)
                    } label: {
                        ItemCardView(item: item)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "cube.box")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)

            Text("No items yet")
                .font(.title2)
                .fontWeight(.medium)

            Text("Add your first item to get started")
                .foregroundStyle(.secondary)

            if authService.isAdmin {
                Button {
                    showingAddItem = true
                } label: {
                    Label("Add Item", systemImage: "plus")
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }
}

#Preview {
    InventoryListView(authService: AuthService.shared)
}
