
export interface Product {
  id: string;
  description: string;
  cost: number;
  quantity: number;
}

export interface CalculationSummary {
  subtotalProducts: number;
  freight: number;
  discount: number;
  markup: number;
  totalInvoice: number;
  totalGeneral: number;
}

export interface CalculatedProduct extends Product {
  totalItem: number;
  apportionedFreight: number;
  adjustedCost: number;
  finalUnitValue: number;
}

export interface SavedCalculation {
  id: string;
  name: string;
  date: string;
  products: Product[];
  freight: number;
  discountPercent: number;
  markupPercent: number;
  totalGeneral: number;
}
