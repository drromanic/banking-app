import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API = '/api';
const COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#65a30d', '#6366f1', '#ea580c', '#475569'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatSEK(n) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
}

function formatMonthLabel(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`;
}

function formatShortMonth(m) {
  const [, mo] = m.split('-');
  return MONTH_SHORT[parseInt(mo, 10) - 1];
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
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [pendingCatChange, setPendingCatChange] = useState(null);
  const [catTab, setCatTab] = useState('breakdown');

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
    await fetchAll();
  };

  // Extract a useful keyword from a transaction description
  // Strips trailing reference numbers (6+ digits and anything after) so the
  // keyword is a real substring of the original and matches future imports.
  function extractKeyword(desc) {
    let cleaned = desc.replace(/\s*\d{6,}.*$/, '').trim();
    return cleaned || desc.replace(/\s+/g, ' ').trim();
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
    .filter(([name, value]) => name !== 'Excluded' && value !== 0)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  // Categories with actual transactions (for consistent colors)
  const sortedChartCategories = [...new Set(includedTransactions.map(t => t.category))].sort();

  // Monthly totals for bar chart
  const monthlyTotals = availableMonths.map(month => {
    const monthTxns = includedTransactions.filter(t => t.date.startsWith(month));
    const total = expandedCategory
      ? monthTxns.filter(t => t.category === expandedCategory).reduce((s, t) => s + t.amount, 0)
      : monthTxns.reduce((s, t) => s + t.amount, 0);
    return { month, total: Math.round(total * 100) / 100 };
  });
  const maxMonthTotal = Math.max(...monthlyTotals.map(m => m.total), 1);
  const selectedMonthTotal = monthlyTotals.find(m => m.month === activeMonth)?.total || 0;

  const totalSpent = summaryFiltered.reduce((s, t) => s + t.amount, 0);

  // Trend: previous month total and % change
  const activeMonthIdx = availableMonths.indexOf(activeMonth);
  const prevMonth = activeMonthIdx > 0 ? availableMonths[activeMonthIdx - 1] : null;
  const prevMonthTotal = prevMonth
    ? monthlyTotals.find(m => m.month === prevMonth)?.total || 0
    : 0;
  const monthChange = prevMonthTotal > 0
    ? ((selectedMonthTotal - prevMonthTotal) / prevMonthTotal) * 100
    : null;

  // Per-category data with trends for horizontal bars
  const catBarData = pieData.map(({ name, value }) => {
    const idx = sortedChartCategories.indexOf(name);
    const color = COLORS[(idx >= 0 ? idx : 0) % COLORS.length];

    // Previous month total for this category
    const prevCatTotal = prevMonth
      ? includedTransactions
          .filter(t => t.date.startsWith(prevMonth) && t.category === name)
          .reduce((s, t) => s + t.amount, 0)
      : 0;
    const catChange = prevCatTotal > 0
      ? ((value - prevCatTotal) / prevCatTotal) * 100
      : null;

    // 3-month rolling average for this category
    const last3Months = availableMonths.slice(Math.max(0, activeMonthIdx - 3), activeMonthIdx);
    const avg3 = last3Months.length > 0
      ? last3Months.reduce((s, m) =>
          s + includedTransactions
            .filter(t => t.date.startsWith(m) && t.category === name)
            .reduce((ss, t) => ss + t.amount, 0), 0) / last3Months.length
      : 0;
    const aboveAvg = avg3 > 0 && value > avg3 * 1.1;

    return { name, value, color, catChange, aboveAvg };
  });
  const maxCatValue = Math.max(...catBarData.map(c => c.value), 1);
  const catsAboveAvg = catBarData.filter(c => c.aboveAvg).length;

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
          <div className="chart-header">
            <div>
              <div className="chart-eyebrow">{expandedCategory || 'Monthly Spending'}</div>
              <div className="chart-month-label">{formatMonthLabel(activeMonth)}</div>
            </div>
            <div className="chart-total">{formatSEK(selectedMonthTotal)}</div>
          </div>
          <div className="month-bars">
            {monthlyTotals.map(({ month, total }) => {
              const isSelected = month === activeMonth;
              const height = maxMonthTotal > 0 ? (total / maxMonthTotal) * 100 : 0;
              return (
                <div key={month} className={`month-bar-col${isSelected ? ' selected' : ''}`} onClick={() => setSelectedMonth(month)}>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ height: `${height}%` }} />
                  </div>
                  <div className="bar-label">{formatShortMonth(month)}</div>
                </div>
              );
            })}
          </div>

          <div className="trend-banner">
            {monthChange !== null ? (
              <span className={`trend-chip ${monthChange <= 0 ? 'positive' : 'negative'}`}>
                {monthChange <= 0 ? '↓' : '↑'} {Math.abs(monthChange).toFixed(1)}% vs last month
              </span>
            ) : (
              <span className="trend-chip neutral">First month</span>
            )}
            {catsAboveAvg > 0 && (
              <span className="trend-chip warn">
                {catsAboveAvg} {catsAboveAvg === 1 ? 'category' : 'categories'} above average
              </span>
            )}
          </div>

          <div className="cat-bars">
            {catBarData.map(({ name, value, color, catChange, aboveAvg }) => {
              const width = maxCatValue > 0 ? (value / maxCatValue) * 100 : 0;
              const isActive = expandedCategory === name;
              return (
                <div key={name} className={`cat-bar-row${isActive ? ' active' : ''}`} onClick={() => {
                  if (isActive) {
                    setExpandedCategory(null);
                    setFilter(f => ({ ...f, category: 'All' }));
                  } else {
                    setExpandedCategory(name);
                    setFilter(f => ({ ...f, category: name }));
                  }
                }}>
                  <div className="cat-bar-label">
                    <span className="cat-dot" style={{ background: color }} />
                    <span className="cat-bar-name">{name}</span>
                  </div>
                  <div className="cat-bar-track">
                    <div className="cat-bar-fill" style={{ width: `${width}%`, background: color }} />
                  </div>
                  <div className="cat-bar-meta">
                    <span className="cat-bar-amount">{formatSEK(value)}</span>
                    {catChange !== null ? (
                      <span className={`cat-bar-trend ${catChange <= 0 ? 'positive' : 'negative'}`}>
                        {catChange <= 0 ? '↓' : '↑'}{Math.abs(catChange).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="cat-bar-trend neutral">—</span>
                    )}
                    {aboveAvg && <span className="cat-bar-warn" title="Above 3-month average" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="category-breakdown">
        <div className="section-header">
          <h2>Category Breakdown</h2>
          <div className="tab-buttons">
            <button className={`tab-btn${catTab === 'breakdown' ? ' active' : ''}`} onClick={() => setCatTab('breakdown')}>Breakdown</button>
            <button className={`tab-btn${catTab === 'settings' ? ' active' : ''}`} onClick={() => setCatTab('settings')}>Settings</button>
          </div>
        </div>
        {catTab === 'breakdown' ? (
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
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="cat-settings">
            <div className="new-cat-form always-visible">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New category name"
                onKeyDown={e => e.key === 'Enter' && addCategory()} />
              <button onClick={addCategory}>Add</button>
            </div>
            <div className="cat-list">
              {categories.filter(c => c !== 'Excluded').map(c => (
                <div key={c} className="cat-setting-row">
                  <span>{c}</span>
                  {c !== 'Other' && c !== 'Excluded' && (
                    <button className="delete-cat-btn" onClick={() => deleteCategory(c)}>Delete</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
