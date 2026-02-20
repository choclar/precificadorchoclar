
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Header from './components/Header';
import CurrencyInput from './components/CurrencyInput';
import { Product, CalculatedProduct, CalculationSummary, SavedCalculation } from './types';
import { getFinancialInsights } from './services/geminiService';

declare var html2pdf: any;

const App: React.FC = () => {
  // Main State
  const [products, setProducts] = useState<Product[]>([
    { id: uuidv4(), description: '', cost: 0, quantity: 1 }
  ]);
  const [freight, setFreight] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [markupPercent, setMarkupPercent] = useState<number>(0);
  
  // App States
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [history, setHistory] = useState<SavedCalculation[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean; type?: 'default' | 'delete' }>({ message: '', visible: false, type: 'default' });

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const simplePdfRef = useRef<HTMLDivElement>(null);

  // Load History on Mount
  useEffect(() => {
    const saved = localStorage.getItem('precificador_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar histórico", e);
      }
    }
  }, []);

  // Calculation logic
  const results = useMemo(() => {
    const subtotalProducts = products.reduce((acc, p) => acc + (p.cost * p.quantity), 0);
    const totalInvoice = subtotalProducts + freight;

    const discountAmount = totalInvoice * (discountPercent / 100);
    const markupAmount = totalInvoice * (markupPercent / 100);
    const totalGeneral = totalInvoice - discountAmount + markupAmount;

    const adjustmentRatio = totalInvoice > 0 ? totalGeneral / totalInvoice : 1;

    const calculatedProducts: CalculatedProduct[] = products.map(p => {
      const itemTotalBase = p.cost * p.quantity;
      const weight = subtotalProducts > 0 ? itemTotalBase / subtotalProducts : 0;
      const apportionedFreight = freight * weight;
      
      const totalItemWithFreight = itemTotalBase + apportionedFreight;
      const totalItemFinal = totalItemWithFreight * adjustmentRatio;
      const finalUnitValue = p.quantity > 0 ? totalItemFinal / p.quantity : 0;

      return {
        ...p,
        totalItem: itemTotalBase,
        apportionedFreight,
        adjustedCost: totalItemFinal,
        finalUnitValue
      };
    });

    const summary: CalculationSummary = {
      subtotalProducts,
      freight,
      discount: discountAmount,
      markup: markupAmount,
      totalInvoice,
      totalGeneral
    };

    return { calculatedProducts, summary };
  }, [products, freight, discountPercent, markupPercent]);

  // Actions
  const addProduct = () => {
    setProducts([...products, { id: uuidv4(), description: '', cost: 0, quantity: 1 }]);
  };

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      const removedItem = products.find(p => p.id === id);
      setProducts(products.filter(p => p.id !== id));
      showToast(`Item "${removedItem?.description || 'sem nome'}" removido.`, 'delete');
    } else {
      showToast("Não é possível remover o último item.", 'delete');
    }
  };

  const updateProduct = (id: string, field: keyof Product, value: string | number) => {
    setProducts(products.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const showToast = (message: string, type: 'default' | 'delete' = 'default') => {
    setToast({ message, visible: true, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const handleGetInsights = async () => {
    setIsLoadingInsights(true);
    const data = await getFinancialInsights(results.calculatedProducts, results.summary);
    setInsights(data || null);
    setIsLoadingInsights(false);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    setTimeout(() => {
      const element = simplePdfRef.current;
      if (!element) return;

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `CHOCLAR_PRECO_${(saveName || 'RELATORIO').toUpperCase()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(element).save().then(() => {
        setIsExporting(false);
      });
    }, 250);
  };

  const saveToHistory = () => {
    if (!saveName.trim()) {
      showToast("⚠️ Dê um nome para a nota primeiro!");
      return;
    }

    const newEntry: SavedCalculation = {
      id: uuidv4(),
      name: saveName,
      date: new Date().toISOString(),
      products: JSON.parse(JSON.stringify(products)),
      freight,
      discountPercent,
      markupPercent,
      totalGeneral: results.summary.totalGeneral
    };

    const newHistory = [newEntry, ...history];
    setHistory(newHistory);
    localStorage.setItem('precificador_history', JSON.stringify(newHistory));
    
    showToast("🚀 Nota salva com sucesso!");

    setProducts([{ id: uuidv4(), description: '', cost: 0, quantity: 1 }]);
    setFreight(0);
    setDiscountPercent(0);
    setMarkupPercent(0);
    setSaveName('');
    setInsights(null);
  };

  const loadFromHistory = (entry: SavedCalculation) => {
    setProducts(entry.products);
    setFreight(entry.freight);
    setDiscountPercent(entry.discountPercent);
    setMarkupPercent(entry.markupPercent);
    setInsights(null);
    setSaveName(entry.name);
    setIsHistoryOpen(false);
    showToast(`📂 Nota "${entry.name}" carregada!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Deseja realmente excluir este registro?")) {
      const newHistory = history.filter(h => h.id !== id);
      setHistory(newHistory);
      localStorage.setItem('precificador_history', JSON.stringify(newHistory));
      showToast("🗑️ Registro excluído.", 'delete');
    }
  };

  return (
    <div className={`min-h-screen pb-32 transition-all duration-300 ${isExporting ? 'exporting-pdf' : ''} bg-slate-950 text-slate-100`}>
      <div ref={pdfContainerRef} className="print:hidden">
      <Header onOpenHistory={() => setIsHistoryOpen(true)} historyCount={history.length} />

      {/* Toast Notification */}
      <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] transition-all duration-500 transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'} no-print w-full max-w-xs sm:max-w-sm px-4`}>
        <div className={`text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border shadow-black/50 ${toast.type === 'delete' ? 'bg-slate-900 border-choc-red/30' : 'bg-slate-900 border-slate-700'}`}>
          <div className={`w-2.5 h-2.5 rounded-full ${toast.type === 'delete' ? 'bg-choc-red animate-pulse' : 'bg-choc-green animate-pulse'}`}></div>
          <span className="text-sm font-bold tracking-tight flex-1">{toast.message}</span>
        </div>
      </div>

      {/* Modern Side Drawer (No-Print) */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-500 ${isHistoryOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none no-print'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsHistoryOpen(false)}></div>
        <div className={`absolute right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 shadow-2xl shadow-black transition-transform duration-500 ease-in-out flex flex-col ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'} rounded-l-3xl overflow-hidden border-l border-slate-800`}>
          <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Histórico <span className="text-choc-blue">CHOC-LAR</span></h2>
            </div>
            <button onClick={() => setIsHistoryOpen(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-all text-slate-400 hover:text-choc-red active:scale-90">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950/50">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
                <p className="text-xl font-bold text-slate-500">Sem notas no baú</p>
              </div>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="group relative bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-choc-blue hover:shadow-xl transition-all cursor-pointer shadow-lg" onClick={() => loadFromHistory(entry)}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-200 text-lg truncate group-hover:text-white transition-colors">{entry.name}</h3>
                    <button onClick={(e) => removeFromHistory(entry.id, e)} className="p-2 text-slate-600 hover:text-choc-red transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                  </div>
                  <p className="text-choc-blue font-black text-xl">R$ {entry.totalGeneral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Header do PDF (Exclusivo para Impressão - Mantém fundo branco) */}
      <div className="print-only p-10 border-b-4 border-choc-blue bg-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-1">Cálculo de Custo <span className="text-choc-blue">CHOC-LAR</span></h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Identificação: <span className="text-slate-900">{saveName || 'NOTA AVULSA'}</span></p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black flex items-center justify-end">
              <span className="text-choc-green">C</span><span className="text-choc-blue">H</span><span className="text-choc-red">O</span><span className="text-choc-pink">C</span>LAR
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Lado Esquerdo: Tabelas */}
        <div className="lg:col-span-8 space-y-10">
          
          {/* Card: Itens do Pedido */}
          <div className="bg-slate-900 rounded-[2rem] shadow-xl border border-slate-800 overflow-hidden print:bg-white print:border-slate-200">
            <div className="px-8 py-6 border-b border-slate-800 bg-slate-900 flex items-center justify-between no-print">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-choc-green/10 text-choc-green rounded-2xl flex items-center justify-center border border-choc-green/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                </div>
                <h2 className="text-xl font-extrabold text-white">Itens Lançados</h2>
              </div>
              <button onClick={addProduct} className="inline-flex items-center gap-2 px-5 py-2.5 bg-choc-green text-white rounded-2xl font-bold text-sm hover:bg-choc-green/90 transition-all shadow-md shadow-choc-green/20">Novo Item</button>
            </div>
            
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-800/50 print:bg-slate-50">
                  <tr className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] border-b border-slate-800 print:border-slate-200">
                    <th className="px-4 py-5 w-auto">Descrição</th>
                    <th className="px-4 py-5 w-40">Custo Compra</th>
                    <th className="px-4 py-5 w-32 text-center">Qtd</th>
                    <th className="px-4 py-5 w-40 text-right">Total Base</th>
                    <th className="px-4 py-5 w-14 no-print"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-800/50 print:hover:bg-transparent transition-colors group/row">
                      <td className="px-4 py-5">
                        <input 
                          type="text" 
                          value={product.description} 
                          onChange={(e) => updateProduct(product.id, 'description', e.target.value)} 
                          placeholder="Produto..." 
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-choc-blue focus:border-transparent outline-none transition-all print:bg-transparent print:border-none print:text-slate-900 print:p-0" 
                        />
                      </td>
                      <td className="px-4 py-5">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                          <CurrencyInput 
                            value={product.cost} 
                            onChange={(val) => updateProduct(product.id, 'cost', val)} 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm font-black text-slate-100 focus:ring-2 focus:ring-choc-blue focus:border-transparent outline-none transition-all print:bg-transparent print:border-none print:text-slate-900 print:p-0" 
                          />
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <input 
                          type="number" 
                          value={product.quantity || ''} 
                          onChange={(e) => updateProduct(product.id, 'quantity', parseInt(e.target.value) || 0)} 
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-black text-center text-slate-100 focus:ring-2 focus:ring-choc-blue focus:border-transparent outline-none transition-all print:bg-transparent print:border-none print:text-slate-900 print:p-0" 
                        />
                      </td>
                      <td className="px-4 py-5 text-right font-bold text-slate-300 print:text-slate-800 text-sm">R$ {(product.cost * product.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-5 text-right no-print">
                        <button 
                          onClick={() => removeProduct(product.id)} 
                          className="p-2 text-slate-600 hover:text-choc-red hover:bg-slate-800 rounded-lg active:scale-90 transition-all"
                          title="Remover Item"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View: Cards (No-Print) */}
            <div className="md:hidden space-y-4 p-6 no-print">
              {products.map((product, index) => (
                <div key={product.id} className="bg-slate-950/50 border border-slate-800 rounded-3xl p-5 relative">
                   <div className="flex justify-between mb-4">
                      <span className="text-[10px] font-black text-choc-blue uppercase">Item {index + 1}</span>
                      <button 
                        onClick={() => removeProduct(product.id)} 
                        className="text-slate-600 hover:text-choc-red transition-colors"
                        title="Remover Item"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                   </div>
                   <input type="text" value={product.description} onChange={(e) => updateProduct(product.id, 'description', e.target.value)} placeholder="Descrição..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mb-4 text-sm font-bold text-white placeholder-slate-600 focus:ring-2 focus:ring-choc-blue outline-none" />
                   <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                        <CurrencyInput value={product.cost} onChange={(val) => updateProduct(product.id, 'cost', val)} className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-choc-blue outline-none" />
                      </div>
                      <input type="number" value={product.quantity || ''} onChange={(e) => updateProduct(product.id, 'quantity', parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-center text-white focus:ring-2 focus:ring-choc-blue outline-none" />
                   </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Custo Real Fracionado (Ajustado para PDF) */}
          <div className="bg-slate-900 rounded-[2rem] shadow-xl border border-slate-800 overflow-hidden print:bg-white print:border-slate-200">
            <div className="px-8 py-6 border-b border-slate-800 bg-gradient-to-r from-choc-blue/10 to-transparent flex items-center justify-between print:border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-choc-blue/10 text-choc-blue rounded-2xl flex items-center justify-center border border-choc-blue/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h2 className="text-xl font-extrabold text-white print:text-slate-800">Custo Final Estratégico</h2>
              </div>
              <span className="no-print text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-950 border border-slate-800 px-3 py-1 rounded-full">Resultado Final</span>
            </div>
            
            <div className="hidden md:block">
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="bg-slate-800/50 print:bg-slate-50">
                  <tr className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] border-b border-slate-800 print:border-slate-200">
                    <th className="px-8 py-5 w-[45%]">Produto</th>
                    <th className="px-8 py-5 w-[25%] text-center">Rateio Operac.</th>
                    <th className="px-8 py-5 w-[30%] text-right">Custo Unit. Real</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                  {results.calculatedProducts.map((p) => (
                    <tr key={`res-${p.id}`}>
                      <td className="px-8 py-6 text-sm text-slate-200 font-bold truncate print:text-slate-700">{p.description || '(Sem descrição)'}</td>
                      <td className="px-8 py-6 text-center">
                        <span className="text-xs font-bold text-slate-500">R$ {p.apportionedFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className="text-lg font-black text-choc-blue">R$ {p.finalUnitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="md:hidden divide-y divide-slate-800 no-print">
               {results.calculatedProducts.map((p) => (
                  <div key={`res-mob-${p.id}`} className="p-6 flex justify-between items-center">
                     <span className="font-bold text-slate-300 text-sm max-w-[50%] truncate">{p.description || '...'}</span>
                     <span className="text-lg font-black text-choc-blue whitespace-nowrap">R$ {p.finalUnitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
               ))}
            </div>
          </div>

          {/* Insights (Opacional no PDF) */}
          {insights && (
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-black/30 border border-slate-800">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-choc-blue/20 rounded-2xl flex items-center justify-center border border-choc-blue/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-choc-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <h3 className="text-xl font-black">Conclusão Consultiva</h3>
                </div>
                <div className="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap">{insights}</div>
            </div>
          )}
        </div>

        {/* Lado Direito: Resumo e Controles (Oculto no PDF por padrão, mas customizado via main) */}
        <div className="lg:col-span-4 space-y-8 no-print">
          
          {/* Card Resumo Financeiro */}
          <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-black/50 border border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-choc-green to-choc-blue"></div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Totalização da Operação</h3>
            
            <div className="space-y-5">
              <div className="flex justify-between text-slate-400 font-bold text-sm"><span>Mercadorias</span><span>R$ {results.summary.subtotalProducts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-choc-blue font-bold text-sm"><span>Frete Aplicado</span><span>+ R$ {results.summary.freight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
              
              <div className="flex justify-between text-slate-200 font-bold text-sm border-y border-dashed border-slate-800 py-3 my-2">
                <span>Total (Itens + Frete)</span>
                <span>R$ {results.summary.totalInvoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>

              {discountPercent > 0 && <div className="flex justify-between text-choc-pink font-bold text-sm"><span>Desconto ({discountPercent}%)</span><span>- R$ {results.summary.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>}
              {markupPercent > 0 && <div className="flex justify-between text-choc-green font-bold text-sm"><span>Ajuste ({markupPercent}%)</span><span>+ R$ {results.summary.markup.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>}
              
              <div className="pt-8 border-t border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Custo Total de Investimento</p>
                <p className="text-4xl font-black text-white tracking-tighter">R$ {results.summary.totalGeneral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-10">
              <button onClick={handleExportPDF} disabled={isExporting} className="w-full py-4.5 bg-white text-slate-900 rounded-3xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover:bg-slate-200">
                {isExporting ? 'PROCESSANDO...' : <><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-choc-blue" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>BAIXAR PDF</>}
              </button>
              <button onClick={handleGetInsights} disabled={isLoadingInsights || results.summary.subtotalProducts === 0} className="w-full py-4.5 bg-choc-blue/10 text-choc-blue border border-choc-blue/30 rounded-3xl font-black text-sm active:scale-95 transition-all hover:bg-choc-blue/20">
                {isLoadingInsights ? 'CONSULTANDO...' : 'IA ESTRATEGISTA'}
              </button>
            </div>
          </div>

          {/* Configurações Globais */}
          <div className="bg-slate-900 rounded-[2rem] shadow-xl border border-slate-800 p-8 space-y-6">
            <h3 className="text-lg font-black text-white flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-choc-yellow"></div>Ajustes Globais</h3>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Valor Total do Frete</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                  <CurrencyInput 
                    value={freight} 
                    onChange={(val) => setFreight(val)} 
                    className="w-full pl-11 pr-5 py-3.5 bg-slate-950 border border-slate-700 rounded-2xl font-black text-white focus:ring-2 focus:ring-choc-blue outline-none transition-all" 
                    placeholder="0,00" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Desc. %</label>
                  <input 
                    type="number" 
                    value={discountPercent || ''} 
                    onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)} 
                    className="w-full px-4 py-3 bg-choc-pink/10 border border-choc-pink/20 rounded-2xl font-black text-white focus:ring-2 focus:ring-choc-pink outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Margem %</label>
                  <input 
                    type="number" 
                    value={markupPercent || ''} 
                    onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)} 
                    className="w-full px-4 py-3 bg-choc-green/10 border border-choc-green/20 rounded-2xl font-black text-white focus:ring-2 focus:ring-choc-green outline-none transition-all" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Finalizar e Salvar */}
          <div className="bg-slate-900 rounded-[2rem] shadow-xl border border-slate-800 p-8 space-y-4">
            <input 
              type="text" 
              placeholder="Nome da nota (Ex: Lote 12)" 
              value={saveName} 
              onChange={(e) => setSaveName(e.target.value)} 
              className="w-full px-5 py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-sm font-bold text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-slate-600 transition-all" 
            />
            <button onClick={saveToHistory} className="w-full py-4.5 bg-white text-slate-900 rounded-3xl font-black text-sm active:scale-95 transition-all hover:bg-slate-200">SALVAR NO HISTÓRICO</button>
          </div>
        </div>

        {/* Resumo Final para PDF (Embaixo de tudo no PDF - Mantém original para impressão) */}
        <div className="print-only mt-10 p-10 bg-slate-900 text-white rounded-xl">
           <div className="grid grid-cols-2 gap-10">
              <div className="space-y-2">
                 <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Resumo Consolidado</p>
                 <p className="flex justify-between text-sm"><span>Subtotal Produtos:</span> <span>R$ {results.summary.subtotalProducts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                 <p className="flex justify-between text-sm"><span>Logística/Frete:</span> <span>R$ {results.summary.freight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                 <p className="flex justify-between text-sm"><span>Descontos Totais:</span> <span>R$ {results.summary.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
              </div>
              <div className="flex flex-col justify-end text-right border-l border-slate-800 pl-10">
                 <p className="text-xs font-black text-choc-blue uppercase tracking-widest mb-1">Investimento Geral</p>
                 <p className="text-4xl font-black">R$ {results.summary.totalGeneral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
           </div>
           <div className="mt-10 pt-10 border-t border-slate-800 text-[9px] text-slate-500 text-center font-bold uppercase tracking-[0.4em]">
              CHOC-LAR • Sistema de Inteligência em Precificação
           </div>
        </div>
      </main>

      {/* Floating Bottom Bar Mobile (No-Print) */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 z-30 no-print">
        <div className="glass-panel p-5 rounded-3xl shadow-2xl border border-white/10 flex justify-between items-center bg-slate-900/90 backdrop-blur-xl">
          <div className="max-w-[140px] truncate">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">Investimento</p>
            <p className="text-xl font-black text-choc-blue truncate">R$ {results.summary.totalGeneral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsHistoryOpen(true)} className="bg-white text-slate-900 p-3 rounded-2xl"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
            <button onClick={handleExportPDF} disabled={isExporting} className="bg-choc-blue text-white px-6 py-3 rounded-2xl font-black shadow-lg text-xs">{isExporting ? '...' : 'PDF'}</button>
          </div>
        </div>
      </div>
      </div>

      {/* Simplified Print Layout */}
      <div ref={simplePdfRef} className="hidden print:block bg-white text-slate-900 p-8 w-full max-w-[210mm] mx-auto">
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight">Relatório de Custos</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">CHOC-LAR • Precificação Inteligente</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{saveName || 'Nota Avulsa'}</p>
            <p className="text-xs text-slate-400 uppercase">{new Date().toLocaleDateString('pt-BR')} • {new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-200 pb-1">1. Detalhamento de Itens</h2>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2 font-bold text-slate-700 w-auto">Descrição</th>
                <th className="py-2 font-bold text-slate-700 w-24 text-right">Custo Un.</th>
                <th className="py-2 font-bold text-slate-700 w-16 text-center">Qtd</th>
                <th className="py-2 font-bold text-slate-700 w-24 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 text-slate-800">{p.description || '-'}</td>
                  <td className="py-2 text-right text-slate-600">R$ {p.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="py-2 text-center text-slate-600">{p.quantity}</td>
                  <td className="py-2 text-right font-medium text-slate-900">R$ {(p.cost * p.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300 font-bold bg-slate-50">
                <td colSpan={3} className="py-2 text-right pr-4">Subtotal Itens:</td>
                <td className="py-2 text-right">R$ {results.summary.subtotalProducts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-200 pb-1">2. Custos Reais (Rateio)</h2>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2 font-bold text-slate-700">Produto</th>
                <th className="py-2 font-bold text-slate-700 w-32 text-right">Custo Final Unit.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.calculatedProducts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 text-slate-800">{p.description || '-'}</td>
                  <td className="py-2 text-right font-bold text-slate-900">R$ {p.finalUnitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t-2 border-slate-900 pt-6">
          <div className="flex justify-between items-start">
            <div className="w-1/2 space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500">Subtotal Produtos</span>
                <span className="font-medium">R$ {results.summary.subtotalProducts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500">Frete / Encargos</span>
                <span className="font-medium">+ R$ {results.summary.freight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between border-b border-slate-100 pb-1 text-red-600">
                  <span>Desconto ({discountPercent}%)</span>
                  <span>- R$ {results.summary.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {markupPercent > 0 && (
                <div className="flex justify-between border-b border-slate-100 pb-1 text-green-600">
                  <span>Margem/Ajuste ({markupPercent}%)</span>
                  <span>+ R$ {results.summary.markup.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Custo Total da Operação</p>
              <p className="text-3xl font-black text-slate-900">R$ {results.summary.totalGeneral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
        
        {insights && (
          <div className="mt-8 p-4 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 italic">
            <strong>Nota da IA:</strong> {insights}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
