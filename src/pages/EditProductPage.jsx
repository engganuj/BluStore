import { useNavigate, useParams } from 'react-router-dom';
import ProductForm from '../components/products/ProductForm';
import VariantEditor from '../components/VariantEditor';
import { useProduct, useUpdateProduct } from '../hooks/useAPI';
import { getProductUrl } from '../utils/helpers';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

function EditProductPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: product, isLoading } = useProduct(id);
  const updateProduct = useUpdateProduct();

  const handleSubmit = (data) => {
    updateProduct.mutate(
      { id, data },
      { onSuccess: () => navigate('/products') }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-4 sm:p-6">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const productUrl = getProductUrl(product);

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/products')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Products
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
          <p className="text-gray-500 mt-1">{product?.name || 'Update product information'}</p>
        </div>
        {productUrl && (
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 border border-primary-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View on storefront
          </a>
        )}
      </div>
      <ProductForm
        initialData={product}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/products')}
        isLoading={updateProduct.isPending}
      />
      
      {/* Variant Editor - Only show for existing products */}
      {id && (
        <VariantEditor
          productId={id}
          productPrice={product?.price}
          productSku={product?.sku}
        />
      )}
    </div>
  );
}

export default EditProductPage;


