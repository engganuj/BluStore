import { useNavigate } from 'react-router-dom';
import ProductForm from '../components/products/ProductForm';
import { useCreateProduct } from '../hooks/useAPI';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

function CreateProductPage() {
  const navigate = useNavigate();
  const createProduct = useCreateProduct();

  const handleSubmit = (data) => {
    createProduct.mutate(data, {
      onSuccess: () => navigate('/products'),
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 sm:p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/products')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Products
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Product</h1>
        <p className="text-gray-500 mt-1">Add a new product to your catalog</p>
      </div>
      <ProductForm
        initialData={null}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/products')}
        isLoading={createProduct.isPending}
      />
    </div>
  );
}

export default CreateProductPage;
