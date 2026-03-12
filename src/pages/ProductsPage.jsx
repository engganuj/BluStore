import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductList from '../components/products/ProductList';
import { useProducts, usePlatforms, useDeleteProduct } from '../hooks/useAPI';
import { PageHeader, Pagination } from '../components/shared';

const PER_PAGE = 25;

function ProductsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Debounced search: we pass the search to the API, but we need to
  // reset page to 1 when search changes
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debounceTimer, setDebounceTimer] = useState(null);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    setDebounceTimer(timer);
  }, [debounceTimer]);

  const handleStatusChange = useCallback((value) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  // Build API params
  const apiParams = {
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  };
  if (debouncedSearch) apiParams.search = debouncedSearch;
  if (statusFilter && statusFilter !== 'all') apiParams.status = statusFilter;

  const { data: productsData, isLoading: productsLoading } = useProducts(apiParams);
  const { data: platforms = [], isLoading: platformsLoading } = usePlatforms();
  const deleteProduct = useDeleteProduct();

  const products = productsData?.products || [];
  const total = productsData?.total || 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  const handleEdit = (product) => {
    navigate(`/products/${product.id}/edit`);
  };

  const handleDelete = (productId) => {
    deleteProduct.mutate(productId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:p-6">
      <PageHeader
        title="Products"
        subtitle="Manage your product catalog"
        action={{
          label: 'New Product',
          onClick: () => navigate('/products/new'),
          icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
        }}
      />
      <ProductList
        products={products}
        total={total}
        platforms={platforms}
        isLoading={productsLoading || platformsLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreateNew={() => navigate('/products/new')}
        // Controlled search/filter state
        searchQuery={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
      />
      {!productsLoading && total > 0 && (
        <div className="mt-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            perPage={PER_PAGE}
            onPageChange={setPage}
            noun="products"
          />
        </div>
      )}
    </div>
  );
}

export default ProductsPage;
