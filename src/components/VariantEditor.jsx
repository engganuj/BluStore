import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  XMarkIcon, 
  TrashIcon, 
  SparklesIcon,
  CheckIcon,
  ChevronDownIcon, 
  ChevronUpIcon 
} from '@heroicons/react/24/outline';
import { variantsAPI } from '../api/client';
import toast from 'react-hot-toast';

/**
 * VariantEditor - Manage product options and variants
 * 
 * Options: Size, Color, Material
 * Values: Small/Medium/Large, Red/Blue/Green
 * Variants: Combinations with unique SKU/price/inventory
 */
export default function VariantEditor({ productId, productPrice, productSku, onVariantsChange }) {
  const [options, setOptions] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);
  
  // New option form
  const [showNewOption, setShowNewOption] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionValues, setNewOptionValues] = useState('');

  // Load options and variants
  useEffect(() => {
    if (productId) {
      loadVariants();
    }
  }, [productId]);

  const loadVariants = async () => {
    try {
      setLoading(true);
      const response = await variantsAPI.getAll(productId);
      setOptions(response.data.options || []);
      setVariants(response.data.variants || []);
      onVariantsChange?.(response.data.variants || []);
    } catch (error) {
      console.error('Failed to load variants:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add new option
  const handleAddOption = async () => {
    if (!newOptionName.trim()) {
      toast.error('Option name is required');
      return;
    }

    const values = newOptionValues
      .split(',')
      .map(v => v.trim())
      .filter(v => v);

    if (values.length === 0) {
      toast.error('At least one value is required');
      return;
    }

    try {
      setSaving(true);
      await variantsAPI.createOption(productId, {
        name: newOptionName.trim(),
        values: values
      });
      toast.success(`Added option: ${newOptionName}`);
      setNewOptionName('');
      setNewOptionValues('');
      setShowNewOption(false);
      loadVariants();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add option');
    } finally {
      setSaving(false);
    }
  };

  // Delete option
  const handleDeleteOption = async (optionId, optionName) => {
    if (!confirm(`Delete option "${optionName}" and all its values? This will also delete related variants.`)) {
      return;
    }

    try {
      await variantsAPI.deleteOption(productId, optionId);
      toast.success('Option deleted');
      loadVariants();
    } catch (error) {
      toast.error('Failed to delete option');
    }
  };

  // Add value to option
  const handleAddValue = async (optionId, value) => {
    if (!value.trim()) return;

    try {
      await variantsAPI.createValue(productId, optionId, { value: value.trim() });
      loadVariants();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add value');
    }
  };

  // Delete value
  const handleDeleteValue = async (optionId, valueId) => {
    try {
      await variantsAPI.deleteValue(productId, optionId, valueId);
      loadVariants();
    } catch (error) {
      toast.error('Failed to delete value');
    }
  };

  // Generate all variant combinations
  const handleGenerateVariants = async () => {
    if (options.length === 0) {
      toast.error('Add at least one option first');
      return;
    }

    try {
      setSaving(true);
      const response = await variantsAPI.generateVariants(productId, {
        base_price: productPrice,
        base_sku_prefix: productSku
      });
      toast.success(response.data.message);
      loadVariants();
    } catch (error) {
      toast.error('Failed to generate variants');
    } finally {
      setSaving(false);
    }
  };

  // Update single variant
  const handleUpdateVariant = async (variantId, updates) => {
    try {
      await variantsAPI.updateVariant(productId, variantId, updates);
      loadVariants();
    } catch (error) {
      toast.error('Failed to update variant');
    }
  };

  // Delete variant
  const handleDeleteVariant = async (variantId) => {
    try {
      await variantsAPI.deleteVariant(productId, variantId);
      toast.success('Variant deleted');
      loadVariants();
    } catch (error) {
      toast.error('Failed to delete variant');
    }
  };

  if (!productId) {
    return (
      <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 text-warning-800">
        Save the product first to add variants.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Product Variants</h3>
          {variants.length > 0 && (
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
              {variants.length} variants
            </span>
          )}
        </div>
        {expanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-6">
          {/* Options Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Options</h4>
              <button
                onClick={() => setShowNewOption(true)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <PlusIcon className="w-4 h-4" />
                Add Option
              </button>
            </div>

            {/* Existing Options */}
            <div className="space-y-3">
              {options.map(option => (
                <OptionRow
                  key={option.id}
                  option={option}
                  onDeleteOption={() => handleDeleteOption(option.id, option.name)}
                  onAddValue={(value) => handleAddValue(option.id, value)}
                  onDeleteValue={(valueId) => handleDeleteValue(option.id, valueId)}
                />
              ))}
            </div>

            {/* New Option Form */}
            {showNewOption && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
                <input
                  type="text"
                  placeholder="Option name (e.g., Size, Color)"
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Values (comma-separated, e.g., Small, Medium, Large)"
                  value={newOptionValues}
                  onChange={(e) => setNewOptionValues(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddOption}
                    disabled={saving}
                    className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    Add Option
                  </button>
                  <button
                    onClick={() => {
                      setShowNewOption(false);
                      setNewOptionName('');
                      setNewOptionValues('');
                    }}
                    className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {options.length === 0 && !showNewOption && (
              <p className="text-sm text-gray-500 italic">
                No options defined. Add options like Size or Color to create variants.
              </p>
            )}
          </div>

          {/* Generate Variants Button */}
          {options.length > 0 && (
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={handleGenerateVariants}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-navy-600 text-white text-sm rounded-lg hover:bg-navy-700 disabled:opacity-50"
              >
                <SparklesIcon className="w-4 h-4" />
                Generate All Variants
              </button>
              <span className="text-sm text-gray-500">
                Creates variants for all option combinations
              </span>
            </div>
          )}

          {/* Variants Table */}
          {variants.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Variant Inventory & Pricing</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Variant</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">SKU</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Price</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Inventory</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map(variant => (
                      <VariantRow
                        key={variant.id}
                        variant={variant}
                        defaultPrice={productPrice}
                        onUpdate={(updates) => handleUpdateVariant(variant.id, updates)}
                        onDelete={() => handleDeleteVariant(variant.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Option row with values
function OptionRow({ option, onDeleteOption, onAddValue, onDeleteValue }) {
  const [newValue, setNewValue] = useState('');
  const [showAddValue, setShowAddValue] = useState(false);

  const handleAdd = () => {
    if (newValue.trim()) {
      onAddValue(newValue.trim());
      setNewValue('');
      setShowAddValue(false);
    }
  };

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">{option.name}</span>
        <button
          onClick={onDeleteOption}
          className="text-gray-400 hover:text-red-500"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {option.values?.map(val => (
          <span
            key={val.id}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-sm"
          >
            {val.color_hex && (
              <span
                className="w-3 h-3 rounded-full border border-gray-300"
                style={{ backgroundColor: val.color_hex }}
              />
            )}
            {val.value}
            <button
              onClick={() => onDeleteValue(val.id)}
              className="text-gray-400 hover:text-red-500 ml-1"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        {showAddValue ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="New value"
              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="text-success-600 hover:text-success-700"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAddValue(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddValue(true)}
            className="px-2 py-1 text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}

// Variant row in table
function VariantRow({ variant, defaultPrice, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(variant.price || '');
  const [inventory, setInventory] = useState(variant.inventory_qty || 0);

  const handleSave = () => {
    onUpdate({
      price: price || null,
      inventory_qty: parseInt(inventory) || 0
    });
    setEditing(false);
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 px-2">
        <span className="font-medium">{variant.option_values_display || variant.name}</span>
      </td>
      <td className="py-2 px-2 text-gray-600">
        {variant.sku || '—'}
      </td>
      <td className="py-2 px-2">
        {editing ? (
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={defaultPrice?.toString()}
            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
            step="0.01"
          />
        ) : (
          <span>
            {variant.price ? `$${parseFloat(variant.price).toFixed(2)}` : `$${parseFloat(defaultPrice || 0).toFixed(2)}`}
          </span>
        )}
      </td>
      <td className="py-2 px-2">
        {editing ? (
          <input
            type="number"
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
          />
        ) : (
          <span className={variant.inventory_qty <= 0 ? 'text-red-600' : ''}>
            {variant.inventory_qty}
          </span>
        )}
      </td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                className="text-success-600 hover:text-success-700 p-1"
              >
                <CheckIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-primary-600 hover:text-primary-700 p-1 text-xs"
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                className="text-gray-400 hover:text-red-500 p-1"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
