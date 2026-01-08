import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Clock, 
  DollarSign, 
  Image as ImageIcon, 
  ExternalLink, 
  AlertTriangle, 
  BarChart2, 
  Wallet,
  Pencil, // <--- Icono editar
  X       // <--- Icono cancelar
} from 'lucide-react';

// --- 1. IMPORTAMOS LAS HERRAMIENTAS DE LA NUBE (FIREBASE) ---
import { initializeApp } from 'firebase/app';
// NOTA: Agregué 'set' aquí porque lo usabas abajo pero no estaba importado
import { getDatabase, ref, onValue, set, update, remove } from 'firebase/database';

// --- 2. TU CONFIGURACIÓN DE CONEXIÓN ---
const firebaseConfig = {
  apiKey: 'AIzaSyCll5PVa4n3BI66GhteDLVwnpYIqb3-cJQ',
  authDomain: 'simple-trading-journaling.firebaseapp.com',
  databaseURL: 'https://simple-trading-journaling-default-rtdb.firebaseio.com',
  projectId: 'simple-trading-journaling',
  storageBucket: 'simple-trading-journaling.firebasestorage.app',
  messagingSenderId: '185302546558',
  appId: '1:185302546558:web:0b5dc4a091e053681e402f',
  measurementId: 'G-THHR69Y4E2',
};

// Inicializamos la aplicación y la base de datos
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const TradingJournal = () => {
  // Estado inicial
  const [trades, setTrades] = useState([]);
  const [editingId, setEditingId] = useState(null); // ID que estamos editando
  const [initialCapital, setInitialCapital] = useState(1000);
  const [loading, setLoading] = useState(true);

  // Estado del formulario
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    asset: '',
    type: 'win',
    amount: '',
    imageUrl: '',
  });

  // --- 3. CONEXIÓN EN TIEMPO REAL (ESCUCHAR CAMBIOS) ---
  useEffect(() => {
    // Escuchar cambios en los Trades
    const tradesRef = ref(db, 'trades');
    onValue(tradesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convertir el objeto de Firebase en un Array
        const tradesArray = Object.values(data).sort((a, b) => b.id - a.id);
        setTrades(tradesArray);
      } else {
        setTrades([]);
      }
      setLoading(false);
    });

    // Escuchar cambios en el Capital Inicial
    const capitalRef = ref(db, 'capital');
    onValue(capitalRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInitialCapital(parseFloat(data));
      }
    });
  }, []);

  // --- 4. FUNCIONES Y LÓGICA ---

  // Guardar cambio de capital
  const handleCapitalChange = (e) => {
    const newVal = parseFloat(e.target.value) || 0;
    setInitialCapital(newVal);
    set(ref(db, 'capital'), newVal);
  };

  // Manejar cambios en los inputs del formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Función para cargar los datos en el formulario para editar
  const handleEdit = (trade) => {
    setEditingId(trade.id);
    setFormData({
      date: trade.date,
      time: trade.time,
      asset: trade.asset,
      type: trade.type || 'win', // Aseguramos que cargue el tipo (win/loss)
      amount: trade.amount,
      imageUrl: trade.imageUrl || ''
    });
    // Scroll hacia arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Función para cancelar la edición y limpiar
  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      asset: '',
      type: 'win',
      amount: '',
      imageUrl: ''
    });
  };

  // LÓGICA INTELIGENTE: CREAR O EDITAR
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.asset || !formData.amount) return;

    // A) SI ESTAMOS EDITANDO (Existe un ID de edición)
    if (editingId) {
      const tradeRef = ref(db, 'trades/' + editingId);
      update(tradeRef, {
        ...formData,
        amount: parseFloat(formData.amount),
      })
        .then(() => {
          handleCancelEdit(); // Salimos del modo edición y limpiamos
        })
        .catch((error) => alert('Error al actualizar: ' + error.message));
    } 
    // B) SI ES NUEVO (No existe ID)
    else {
      const tradeId = Date.now();
      const newTrade = {
        id: tradeId,
        ...formData,
        amount: parseFloat(formData.amount),
      };
      
      set(ref(db, 'trades/' + tradeId), newTrade)
        .then(() => {
          handleCancelEdit(); // Limpiamos el formulario (reusa la misma lógica de reset)
        })
        .catch((error) => alert('Error al guardar: ' + error.message));
    }
  };

  // Borrar trade de la nube
  const deleteTrade = (id) => {
    if (window.confirm('¿Seguro que quieres eliminar esta operación?')) {
      remove(ref(db, 'trades/' + id));
      // Si borramos el que estábamos editando, cancelamos la edición
      if (editingId === id) handleCancelEdit();
    }
  };

  // --- CÁLCULOS ESTADÍSTICOS ---
  const totalProfit = trades.reduce((acc, trade) => {
    return trade.type === 'win' ? acc + trade.amount : acc - trade.amount;
  }, 0);

  const totalWins = trades.filter((t) => t.type === 'win').length;
  const winRate =
    trades.length > 0 ? ((totalWins / trades.length) * 100).toFixed(1) : 0;

  // Cálculo del Max Drawdown
  const sortedTrades = [...trades].sort((a, b) => {
    return new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`);
  });

  let currentEquity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdownAbs = 0;
  let maxDrawdownPct = 0;

  sortedTrades.forEach((trade) => {
    const pnl = trade.type === 'win' ? trade.amount : -trade.amount;
    currentEquity += pnl;

    if (currentEquity > peakEquity) peakEquity = currentEquity;

    const drawdown = peakEquity - currentEquity;
    const drawdownPct = peakEquity > 0 ? (drawdown / peakEquity) * 100 : 0;

    if (drawdown > maxDrawdownAbs) maxDrawdownAbs = drawdown;
    if (drawdownPct > maxDrawdownPct) maxDrawdownPct = drawdownPct;
  });

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Cargando tu diario...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header y Stats */}
        <header className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart2 className="w-8 h-8 text-indigo-600" />
              Diario Cloud
            </h1>

            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500">
                <Wallet className="w-4 h-4" />
                <span className="text-sm font-medium">Capital Inicial:</span>
              </div>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  $
                </span>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={handleCapitalChange}
                  className="w-28 pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* PnL Neto */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
              <div
                className={`p-3 rounded-full shrink-0 ${
                  totalProfit >= 0
                    ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                  PnL Neto
                </p>
                <p
                  className={`text-xl font-bold truncate ${
                    totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {totalProfit >= 0 ? '+' : ''}
                  {totalProfit.toLocaleString('es-ES', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {/* Win Rate */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
              <div className="p-3 rounded-full shrink-0 bg-blue-100 text-blue-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                  Win Rate
                </p>
                <p className="text-xl font-bold text-slate-900">{winRate}%</p>
              </div>
            </div>

            {/* Max Drawdown */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
              <div className="p-3 rounded-full shrink-0 bg-orange-100 text-orange-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                  Max Drawdown
                </p>
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-orange-600">
                    -{maxDrawdownPct.toFixed(2)}%
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    -$
                    {maxDrawdownAbs.toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Trades */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
              <div className="p-3 rounded-full shrink-0 bg-indigo-100 text-indigo-600">
                <Clock className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                  Trades
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {trades.length}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Formulario */}
        <section className={`rounded-2xl shadow-sm border p-6 transition-colors ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
          <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${editingId ? 'text-blue-700' : 'text-slate-700'}`}>
            {editingId ? (
              <><Pencil className="w-5 h-5" /> Editando Operación</>
            ) : (
              <><PlusCircle className="w-5 h-5" /> Registrar Nueva Operación</>
            )}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end"
          >
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Fecha
              </label>
              <input
                type="date"
                name="date"
                required
                value={formData.date}
                onChange={handleInputChange}
                className="w-full rounded-lg border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 bg-white border"
              />
            </div>

            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Hora
              </label>
              <input
                type="time"
                name="time"
                required
                value={formData.time}
                onChange={handleInputChange}
                className="w-full rounded-lg border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 bg-white border"
              />
            </div>

            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Activo
              </label>
              <input
                type="text"
                name="asset"
                required
                placeholder="BTC"
                value={formData.asset.toUpperCase()}
                onChange={handleInputChange}
                className="w-full rounded-lg border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 bg-white border uppercase"
              />
            </div>

            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Resultado
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className={`w-full rounded-lg border-slate-200 text-sm p-2.5 border font-medium ${
                  formData.type === 'win'
                    ? 'text-green-600 bg-green-50'
                    : 'text-red-600 bg-red-50'
                }`}
              >
                <option value="win">Ganada (TP)</option>
                <option value="loss">Perdida (SL)</option>
              </select>
            </div>

            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Monto ($)
              </label>
              <input
                type="number"
                name="amount"
                required
                placeholder="0.00"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={handleInputChange}
                className="w-full rounded-lg border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 bg-white border"
              />
            </div>

            <div className="lg:col-span-1 flex gap-2">
              <button
                type="submit"
                className={`flex-1 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors flex items-center justify-center gap-2 text-white ${
                  editingId 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {editingId ? <Pencil className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                {editingId ? 'Guardar' : 'Agregar'}
              </button>
              
              {/* Botón de Cancelar solo visible si estamos editando */}
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-red-100 hover:bg-red-200 text-red-600 p-2.5 rounded-lg transition-colors"
                  title="Cancelar edición"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="lg:col-span-6">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Link del Gráfico (Opcional)
              </label>
              <input
                type="url"
                name="imageUrl"
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={handleInputChange}
                className="w-full rounded-lg border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 bg-white border"
              />
            </div>
          </form>
        </section>

        {/* Lista de Trades */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-700">
            Historial (Sincronizado en Nube)
          </h3>

          {trades.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
              <p className="text-slate-500">
                No hay operaciones. Agrega una y aparecerá en todos tus
                dispositivos.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {trades.map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  onDelete={deleteTrade}
                  onEdit={handleEdit} // <--- Pasamos la función de editar
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const TradeCard = ({ trade, onDelete, onEdit }) => { // <--- Recibimos onEdit
  const [showImage, setShowImage] = useState(false);
  const isWin = trade.type === 'win';

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-l-4 p-5 transition-all hover:shadow-md ${
        isWin ? 'border-l-green-500' : 'border-l-red-500'
      }`}
    >
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-full shrink-0 ${
              isWin ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            {isWin ? (
              <TrendingUp className={`w-5 h-5 text-green-600`} />
            ) : (
              <TrendingDown className={`w-5 h-5 text-red-600`} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-800">
                {trade.asset}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                  isWin
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {isWin ? 'Ganada' : 'Perdida'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {trade.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {trade.time}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
          <div className="text-right">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              Resultado
            </p>
            <p
              className={`text-xl font-bold ${
                isWin ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isWin ? '+' : '-'}${trade.amount.toFixed(2)}
            </p>
          </div>

          <div className="flex gap-2">
            {trade.imageUrl && (
              <button
                onClick={() => setShowImage(!showImage)}
                className={`p-2 rounded-lg transition-colors ${
                  showImage
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            )}
            
            {/* --- BOTÓN EDITAR (LÁPIZ) --- */}
            <button
              onClick={() => onEdit(trade)}
              className="p-2 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
            >
              <Pencil className="w-5 h-5" />
            </button>

            <button
              onClick={() => onDelete(trade.id)}
              className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      {showImage && trade.imageUrl && (
        <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-slate-500">
              Prueba del gráfico
            </span>
            <a
              href={trade.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 flex items-center gap-1 hover:underline"
            >
              Abrir original <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 relative min-h-[200px] flex items-center justify-center">
            <img
              src={trade.imageUrl}
              alt={`Gráfico de ${trade.asset}`}
              className="max-w-full h-auto object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.parentElement.innerHTML =
                  '<div class="text-sm text-red-500 p-4">Error al cargar imagen.</div>';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingJournal;