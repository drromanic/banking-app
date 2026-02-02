import React, { useState, useEffect, useCallback } from 'react';
import { Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import './App.css';

const API = '/api';
const COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#65a30d', '#6366f1', '#ea580c', '#475569'];

function formatSEK(n) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
}

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sourceFiles, setSourceFiles] = useState([]);
  const [filter, setFilter] = useState({ category: 'All', cardHolder: 'All', sourceFile: 'All' });
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [uploading, setUploading] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [pendingCatChange, setPendingCatChange] = useState(null);

  const fetchAll = useCallback(async () => {
    const [txRes, catRes, sfRes] = await Promise.all([
      fetch(`${API}/transactions`), fetch(`${API}/categories`), fetch(`${API}/source-files`),
    ]);
    setTransactions(await txRes.json());
    setCategories(await catRes.json());
    setSourceFiles(await sfRes.json());
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const uploadFile = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target.files[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    await fetch(`${API}/upload`, { method: 'POST', body: form });
    await fetchAll();
    setUploading(false);
  };

  const deleteCategory = async (name) => {
    if (!window.confirm(`Delete category "${name}"? All its transactions will be moved to "Other".`)) return;
    await fetch(`${API}/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
    setExpandedCategory(null);
    setFilter(f => ({ ...f, category: 'All' }));
    await fetchAll();
  };

  const changeCategory = (txnId, description, newCategory) => {
    setPendingCatChange({ txnId, description, newCategory });
    setEditingTxn(null);
  };

  const applyPendingCatChange = async (applyAll) => {
    if (!pendingCatChange) return;
    const { txnId, description, newCategory } = pendingCatChange;
    if (applyAll) {
      const keyword = extractKeyword(description);
      await fetch(`${API}/category-rules/${encodeURIComponent(keyword)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
    } else {
      await fetch(`${API}/transactions/${txnId}/category`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
    }
    setPendingCatChange(null);
    await fetchAll();
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await fetch(`${API}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    setNewCatName('');
    setShowNewCat(false);
    await fetchAll();
  };

  // Extract a useful keyword from a transaction description
  function extractKeyword(desc) {
    // Remove trailing numbers/dates and clean up
    let cleaned = desc.replace(/[\d]{6,}/g, '').replace(/\s+/g, ' ').trim();
    // Use the full description minus trailing junk as keyword
    return cleaned || desc;
  }

  // Exclude "Excluded" transactions from all calculations unless explicitly filtered
  const includedTransactions = transactions.filter(t => t.category !== 'Excluded');

  // Derive available months and default selectedMonth to latest
  const availableMonths = [...new Set(includedTransactions.map(t => t.date.slice(0, 7)))].sort();
  const activeMonth = selectedMonth && availableMonths.includes(selectedMonth) ? selectedMonth : availableMonths[availableMonths.length - 1] || null;

  // Set selectedMonth on first load
  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [availableMonths.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // For summaries/charts: exclude "Excluded" transactions
  const monthFilteredIncluded = activeMonth ? includedTransactions.filter(t => t.date.startsWith(activeMonth)) : includedTransactions;

  // For transaction table: show everything (including "Excluded")
  const allMonthFiltered = activeMonth ? transactions.filter(t => t.date.startsWith(activeMonth)) : transactions;

  const filtered = allMonthFiltered.filter(t =>
    (filter.category === 'All' || t.category === filter.category) &&
    (filter.cardHolder === 'All' || t.card_holder === filter.cardHolder) &&
    (filter.sourceFile === 'All' || t.source_file === filter.sourceFile)
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
    else if (sortKey === 'amount') cmp = a.amount - b.amount;
    else if (sortKey === 'description') cmp = a.description.localeCompare(b.description);
    else if (sortKey === 'category') cmp = a.category.localeCompare(b.category);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const allCategories = ['All', ...categories];
  const cardHolders = ['All', ...new Set(transactions.map(t => t.card_holder))];
  const allSourceFiles = ['All', ...sourceFiles];

  // Summaries and charts: only non-excluded transactions for the selected month
  const summaryFiltered = monthFilteredIncluded.filter(t =>
    (filter.category === 'All' || t.category === filter.category) &&
    (filter.cardHolder === 'All' || t.card_holder === filter.cardHolder) &&
    (filter.sourceFile === 'All' || t.source_file === filter.sourceFile)
  );

  const catTotals = {};
  categories.forEach(c => { catTotals[c] = 0; });
  summaryFiltered.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
  const pieData = Object.entries(catTotals)
    .filter(([name]) => name !== 'Excluded')
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  // Monthly bar chart: stacked by category, using all included transactions
  const monthCatTotals = {};
  const allChartCategories = new Set();
  includedTransactions.forEach(t => {
    const month = t.date.slice(0, 7);
    if (!monthCatTotals[month]) monthCatTotals[month] = {};
    monthCatTotals[month][t.category] = (monthCatTotals[month][t.category] || 0) + t.amount;
    allChartCategories.add(t.category);
  });
  const sortedChartCategories = [...allChartCategories].sort();
  const monthlyData = Object.entries(monthCatTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cats]) => {
      const row = { month };
      sortedChartCategories.forEach(cat => { row[cat] = Math.round((cats[cat] || 0) * 100) / 100; });
      return row;
    });

  const totalSpent = summaryFiltered.reduce((s, t) => s + t.amount, 0);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const sortIcon = (key) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  if (transactions.length === 0 && !uploading) {
    return (
      <div className="app">
        <div className="upload-zone" onDrop={uploadFile} onDragOver={e => e.preventDefault()}>
          <div className="upload-content">
            <div className="upload-icon">📄</div>
            <h1>Banking Transaction Analyzer</h1>
            <p>Drag & drop your Excel bank statement here</p>
            <p className="subtle">or</p>
            <label className="file-btn">
              Choose File
              <input type="file" accept=".xlsx,.xls" onChange={uploadFile} hidden />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Transaction Summary</h1>
        <div className="header-actions">
          <label className="file-btn small">
            {uploading ? 'Uploading...' : 'Import File'}
            <input type="file" accept=".xlsx,.xls" onChange={uploadFile} hidden disabled={uploading} />
          </label>
        </div>
      </header>

      <div className="chart-full">
        <div className="chart-box">
          <h2>{expandedCategory ? `Monthly Spending — ${expandedCategory}` : 'Monthly Spending by Category'}</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={monthlyData} onClick={(e) => { if (e && e.activeLabel) setSelectedMonth(e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatSEK(v)} />
              {!expandedCategory && <Legend />}
              {(expandedCategory ? [expandedCategory] : sortedChartCategories).map((cat) => {
                const i = sortedChartCategories.indexOf(cat);
                return <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[i % COLORS.length]} cursor="pointer" />;
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="category-breakdown">
        <div className="section-header">
          <h2>Category Breakdown</h2>
          {!showNewCat ? (
            <button className="add-cat-btn" onClick={() => setShowNewCat(true)}>+ Add Category</button>
          ) : (
            <div className="new-cat-form">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name"
                onKeyDown={e => e.key === 'Enter' && addCategory()} />
              <button onClick={addCategory}>Add</button>
              <button className="cancel-btn" onClick={() => { setShowNewCat(false); setNewCatName(''); }}>Cancel</button>
            </div>
          )}
        </div>
        <table>
          <thead>
            <tr><th>Category</th><th>Count</th><th>Total</th><th>% of Total</th></tr>
          </thead>
          <tbody>
            {expandedCategory && (
              <tr className="cat-back-row" onClick={() => { setExpandedCategory(null); setFilter(f => ({ ...f, category: 'All' })); }}>
                <td colSpan={4}>← All Categories</td>
              </tr>
            )}
            {pieData.filter(p => !expandedCategory || p.name === expandedCategory).map(({ name, value }) => {
              const idx = sortedChartCategories.indexOf(name);
              const color = COLORS[(idx >= 0 ? idx : 0) % COLORS.length];
              const isExpanded = expandedCategory === name;
              const vendorTotals = {};
              if (isExpanded) {
                summaryFiltered.filter(t => t.category === name).forEach(t => {
                  vendorTotals[t.description] = (vendorTotals[t.description] || 0) + t.amount;
                });
              }
              const vendors = Object.entries(vendorTotals)
                .map(([desc, total]) => ({ desc, total }))
                .sort((a, b) => b.total - a.total);
              return (
                <React.Fragment key={name}>
                  <tr className="cat-row" onClick={() => {
                    if (isExpanded) {
                      setExpandedCategory(null);
                      setFilter(f => ({ ...f, category: 'All' }));
                    } else {
                      setExpandedCategory(name);
                      setFilter(f => ({ ...f, category: name }));
                    }
                  }}>
                    <td><span className="cat-dot" style={{ background: color }} />{name} {isExpanded ? '▾' : '▸'}</td>
                    <td>{summaryFiltered.filter(t => t.category === name).length}</td>
                    <td className="mono">{formatSEK(value)}</td>
                    <td>{totalSpent ? (value / totalSpent * 100).toFixed(1) : '0'}%</td>
                  </tr>
                  {isExpanded && vendors.map(({ desc, total }) => (
                    <tr key={desc} className="vendor-row">
                      <td className="vendor-name">{desc}</td>
                      <td>{summaryFiltered.filter(t => t.category === name && t.description === desc).length}</td>
                      <td className="mono">{formatSEK(total)}</td>
                      <td>{value ? (total / value * 100).toFixed(1) : '0'}%</td>
                    </tr>
                  ))}
                  {isExpanded && name !== 'Other' && name !== 'Excluded' && (
                    <tr className="cat-delete-row">
                      <td colSpan={4}>
                        <button className="delete-cat-btn" onClick={(e) => { e.stopPropagation(); deleteCategory(name); }}>
                          Delete category
                        </button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="filters">
        <h2>Transactions</h2>
        <div className="filter-controls">
          <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
            {allCategories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={filter.cardHolder} onChange={e => setFilter(f => ({ ...f, cardHolder: e.target.value }))}>
            {cardHolders.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={filter.sourceFile} onChange={e => setFilter(f => ({ ...f, sourceFile: e.target.value }))}>
            {allSourceFiles.map(f => <option key={f}>{f}</option>)}
          </select>
          {(filter.category !== 'All' || filter.cardHolder !== 'All' || filter.sourceFile !== 'All') && (
            <button className="clear-btn" onClick={() => setFilter({ category: 'All', cardHolder: 'All', sourceFile: 'All' })}>Clear Filters</button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort('date')}>Date{sortIcon('date')}</th>
              <th onClick={() => toggleSort('description')}>Description{sortIcon('description')}</th>
              <th>City</th>
              <th onClick={() => toggleSort('category')}>Category{sortIcon('category')}</th>
              <th>Card Holder</th>
              <th onClick={() => toggleSort('amount')}>Amount{sortIcon('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const cIdx = sortedChartCategories.indexOf(t.category);
              const isEditing = editingTxn === t.id;
              return (
                <tr key={t.id}>
                  <td className="mono">{t.date}</td>
                  <td>{t.description}</td>
                  <td>{t.city}</td>
                  <td>
                    {isEditing ? (
                      <select className="cat-select" autoFocus value={t.category}
                        onChange={e => changeCategory(t.id, t.description, e.target.value)}
                        onBlur={() => setTimeout(() => setEditingTxn(null), 150)}>
                        {categories.map(c => <option key={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span className="badge clickable"
                        style={{ background: COLORS[cIdx % COLORS.length] + '22', color: COLORS[cIdx % COLORS.length] }}
                        onClick={() => setEditingTxn(t.id)}
                        title="Click to change category">
                        {t.category}
                      </span>
                    )}
                  </td>
                  <td>{t.card_holder}</td>
                  <td className="mono amount">{formatSEK(t.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendingCatChange && (
        <div className="modal-overlay" onClick={() => setPendingCatChange(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p>Apply <strong>"{pendingCatChange.newCategory}"</strong> to all transactions matching <strong>"{extractKeyword(pendingCatChange.description)}"</strong>?</p>
            <div className="modal-buttons">
              <button className="modal-btn primary" onClick={() => applyPendingCatChange(true)}>Yes, apply to all</button>
              <button className="modal-btn" onClick={() => applyPendingCatChange(false)}>No, only this one</button>
              <button className="modal-btn cancel" onClick={() => setPendingCatChange(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
