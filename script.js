        // Data State
        let appData = JSON.parse(localStorage.getItem('liquorShopData')) || [];
        let historyData = JSON.parse(localStorage.getItem('liquorShopHistory')) || [];

        // Utilities
        function generateId() { return Math.random().toString(36).substr(2, 9); }
        function formatMoney(num) { return num.toFixed(2); }
        function saveToLocal() { localStorage.setItem('liquorShopData', JSON.stringify(appData)); }

        // Core Functions
        function addRow() {
            appData.push({
                id: generateId(),
                name: '',
                mrp: { q: '', p: '', n: '' },
                discount: { q: '', p: '', n: '' },
                cost: { q: '', p: '', n: '' },
                qty: { q: '', p: '', n: '' },
                dqty: { q: '', p: '', n: '' }
            });
            saveToLocal();
            renderTable();
        }

        function deleteRow(id) {
            if(confirm('Are you sure you want to delete this brand row?')) {
                appData = appData.filter(r => r.id !== id);
                saveToLocal();
                renderTable();
            }
        }

        function resetData() {
            if(confirm('WARNING: This will delete all your data! Are you sure?')) {
                appData = [];
                saveToLocal();
                renderTable();
            }
        }

        function startNewDay() {
            const dateStr = prompt('Enter a name or date for today\'s record to save it to History:', new Date().toLocaleDateString());
            if(dateStr === null) return; // Cancelled
            
            if(confirm('Are you sure you want to start a new day?\nThis will save the current data to history and reset all Quantities Sold back to zero.')) {
                // Save Snapshot to History
                const snapshot = JSON.parse(JSON.stringify(appData));
                historyData.push({
                    id: generateId(),
                    date: dateStr,
                    timestamp: Date.now(),
                    data: snapshot
                });
                localStorage.setItem('liquorShopHistory', JSON.stringify(historyData));
                
                // Clear Quantities
                appData.forEach(row => {
                    row.qty = { q: '', p: '', n: '' };
                    row.dqty = { q: '', p: '', n: '' };
                });
                saveToLocal();
                renderTable();
                alert('Saved to History! Quantities have been reset.');
            }
        }

        function updateData(id, field, size, value) {
            const row = appData.find(r => r.id === id);
            if (!row) return;
            
            if (size) {
                row[field][size] = value;
            } else {
                row[field] = value;
            }
            
            saveToLocal();
            updateRowCalculations(row);
            updateDashboard();
        }

        function getColorClass(val, baseClasses) {
            if (val > 0) return `${baseClasses} text-emerald-600 dark:text-emerald-400`;
            if (val < 0) return `${baseClasses} text-red-600 dark:text-red-400`;
            return `${baseClasses} text-slate-700 dark:text-slate-300`;
        }

        function updateRowCalculations(row) {
            let brandProfit = 0;
            ['q', 'p', 'n'].forEach(size => {
                const mrp = parseFloat(row.mrp[size]) || 0;
                const disc = parseFloat(row.discount[size]) || 0;
                const cost = parseFloat(row.cost[size]) || 0;
                const qty = parseFloat(row.qty[size]) || 0;
                const dqty = row.dqty ? (parseFloat(row.dqty[size]) || 0) : 0;
                
                const tmp = (mrp - cost) * qty;
                const tdp = (disc - cost) * dqty;
                
                brandProfit += tmp + tdp;
                
                const tmpEl = document.getElementById(`tmp_${size}_${row.id}`);
                if(tmpEl) {
                    tmpEl.textContent = formatMoney(tmp);
                    tmpEl.className = getColorClass(tmp, "p-2 border-r border-slate-200 dark:border-slate-700 text-right font-medium bg-cyan-50/30 dark:bg-cyan-900/10");
                }
                
                const tdpEl = document.getElementById(`tdp_${size}_${row.id}`);
                if(tdpEl) {
                    tdpEl.textContent = formatMoney(tdp);
                    tdpEl.className = getColorClass(tdp, "p-2 border-r border-slate-200 dark:border-slate-700 text-right font-medium bg-emerald-50/30 dark:bg-emerald-900/10");
                }
            });
            
            const bpEl = document.getElementById(`bp_${row.id}`);
            if(bpEl) {
                bpEl.textContent = formatMoney(brandProfit);
                bpEl.className = getColorClass(brandProfit, "p-3 border-r border-slate-200 dark:border-slate-700 text-right font-bold bg-amber-50/50 dark:bg-amber-900/20 text-base");
            }
        }

        function updateDashboard() {
            let totalBrands = appData.length;
            let totalBottles = 0;
            let grandTotalProfit = 0;
            
            appData.forEach(row => {
                ['q', 'p', 'n'].forEach(size => {
                    const mrp = parseFloat(row.mrp[size]) || 0;
                    const disc = parseFloat(row.discount[size]) || 0;
                    const cost = parseFloat(row.cost[size]) || 0;
                    const qty = parseFloat(row.qty[size]) || 0;
                    const dqty = row.dqty ? (parseFloat(row.dqty[size]) || 0) : 0;
                    
                    totalBottles += qty + dqty;
                    const tmp = (mrp - cost) * qty;
                    const tdp = (disc - cost) * dqty;
                    grandTotalProfit += tmp + tdp;
                });
            });
            
            document.getElementById('dash-brands').textContent = totalBrands;
            document.getElementById('dash-bottles').textContent = totalBottles;
            
            const dashProfit = document.getElementById('dash-profit');
            dashProfit.textContent = '₹' + formatMoney(grandTotalProfit);
            dashProfit.className = `text-2xl font-bold ${grandTotalProfit > 0 ? 'text-emerald-600 dark:text-emerald-400' : (grandTotalProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200')}`;
        }

        // Rendering logic
        function initHeaders() {
            const subHeaders = document.getElementById('sub-headers');
            let html = '';
            
            // Generate 7 groups of Q, P, N
            const groups = [
                { bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
                { bg: 'bg-pink-50/50 dark:bg-pink-900/10' },
                { bg: 'bg-orange-50/50 dark:bg-orange-900/10' },
                { bg: 'bg-purple-50/50 dark:bg-purple-900/10' },
                { bg: 'bg-indigo-50/50 dark:bg-indigo-900/10' },
                { bg: 'bg-cyan-50/50 dark:bg-cyan-900/10' },
                { bg: 'bg-emerald-50/50 dark:bg-emerald-900/10' }
            ];

            groups.forEach(g => {
                ['Q', 'P', 'N'].forEach(size => {
                    html += `<th class="p-2 border-r border-b border-slate-300 dark:border-slate-600 w-20 text-center ${g.bg}">${size}</th>`;
                });
            });
            
            subHeaders.innerHTML = html;
        }

        function renderTable() {
            const tbody = document.getElementById('table-body');
            tbody.innerHTML = '';
            
            appData.forEach(row => {
                if(!row.dqty) row.dqty = {q:'', p:'', n:''};
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group";
                
                const renderInput = (field, size) => `
                    <td class="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input type="number" step="any" value="${row[field][size]}" oninput="updateData('${row.id}', '${field}', '${size}', this.value)" 
                        class="w-full min-w-[65px] text-right p-1.5 bg-white dark:bg-darkBg border border-slate-300 dark:border-slate-600 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all shadow-inner">
                    </td>
                `;

                const renderOutput = (prefix, size) => `
                    <td id="${prefix}_${size}_${row.id}" class="p-2 border-r border-slate-200 dark:border-slate-700 text-right font-medium">0.00</td>
                `;

                tr.innerHTML = `
                    <td class="sticky-col bg-white dark:bg-darkCard p-1 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 transition-colors z-10">
                        <input type="text" value="${row.name}" placeholder="Brand Name" oninput="updateData('${row.id}', 'name', null, this.value)" 
                        class="w-full min-w-[160px] p-2 bg-white dark:bg-darkBg border border-slate-300 dark:border-slate-600 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium transition-all shadow-inner">
                    </td>
                    
                    ${renderInput('mrp', 'q')}
                    ${renderInput('mrp', 'p')}
                    ${renderInput('mrp', 'n')}
                    
                    ${renderInput('discount', 'q')}
                    ${renderInput('discount', 'p')}
                    ${renderInput('discount', 'n')}
                    
                    ${renderInput('cost', 'q')}
                    ${renderInput('cost', 'p')}
                    ${renderInput('cost', 'n')}
                    
                    ${renderInput('qty', 'q')}
                    ${renderInput('qty', 'p')}
                    ${renderInput('qty', 'n')}
                    
                    ${renderInput('dqty', 'q')}
                    ${renderInput('dqty', 'p')}
                    ${renderInput('dqty', 'n')}
                    
                    ${renderOutput('tmp', 'q')}
                    ${renderOutput('tmp', 'p')}
                    ${renderOutput('tmp', 'n')}
                    
                    ${renderOutput('tdp', 'q')}
                    ${renderOutput('tdp', 'p')}
                    ${renderOutput('tdp', 'n')}
                    
                    <td id="bp_${row.id}" class="p-3 border-r border-slate-200 dark:border-slate-700 text-right font-bold bg-amber-50/30 dark:bg-amber-900/10 text-base">0.00</td>
                    
                    <td class="p-2 text-center bg-white dark:bg-darkCard group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 transition-colors">
                        <button onclick="deleteRow('${row.id}')" class="text-slate-400 hover:text-red-500 transition-colors p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete Row">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
                updateRowCalculations(row);
            });
            updateDashboard();
        }

        // Features
        function filterTable() {
            const term = document.getElementById('search-input').value.toLowerCase();
            const rows = document.querySelectorAll('#table-body tr');
            rows.forEach(tr => {
                const input = tr.querySelector('td:first-child input');
                if (input && input.value.toLowerCase().includes(term)) {
                    tr.style.display = '';
                } else {
                    tr.style.display = 'none';
                }
            });
        }

        function toggleDarkMode() {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('liquorDarkMode', isDark ? '1' : '0');
        }



        function toggleHistoryMode() {
            const mainApp = document.getElementById('main-app-content');
            const historyApp = document.getElementById('history-content');
            
            if(mainApp.classList.contains('hidden')) {
                mainApp.classList.remove('hidden');
                historyApp.classList.add('hidden');
            } else {
                mainApp.classList.add('hidden');
                historyApp.classList.remove('hidden');
                renderHistoryFeed();
            }
        }
        
        function renderHistoryFeed() {
            const feed = document.getElementById('history-feed');
            const emptyState = document.getElementById('history-empty-state');
            
            if(historyData.length === 0) {
                feed.innerHTML = '';
                emptyState.classList.remove('hidden');
                return;
            }
            
            emptyState.classList.add('hidden');
            let feedHtml = '';
            
            const reversed = [...historyData].reverse();
            
            reversed.forEach(record => {
                let totalBrands = record.data.length;
                let totalBottles = 0;
                let grandTotalProfit = 0;
                
                // pre-calculate summary
                record.data.forEach(row => {
                    ['q', 'p', 'n'].forEach(s => {
                        const m = parseFloat(row.mrp[s]) || 0;
                        const d = parseFloat(row.discount[s]) || 0;
                        const c = parseFloat(row.cost[s]) || 0;
                        const q = parseFloat(row.qty[s]) || 0;
                        const dq = row.dqty ? (parseFloat(row.dqty[s]) || 0) : 0;
                        totalBottles += q + dq;
                        grandTotalProfit += ((m - c) * q) + ((d - c) * dq);
                    });
                });
                
                const profitClass = grandTotalProfit > 0 ? 'text-emerald-600 dark:text-emerald-400' : (grandTotalProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200');
                const timeStr = new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                // Build Table HTML
                let tableHtml = `
                <div id="table_${record.id}" class="hidden mt-4 overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table class="min-w-max w-full text-sm text-left border-collapse">
                    <thead class="text-xs uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-600">
                        <tr>
                            <th rowspan="2" class="sticky-col bg-slate-100 dark:bg-slate-800 p-2 border-r border-b border-slate-300 dark:border-slate-600">Brand Name</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">MRP</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-pink-50 dark:bg-pink-900/20 text-pink-800 dark:text-pink-300">Discount</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300">Buying Cost</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300">MRP QTY SOLD</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300">DISCOUNT QTY SOLD</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-800 dark:text-cyan-300">TOTAL MRP PROFIT</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300">TOTAL DISCOUNT PROFIT</th>
                            <th rowspan="2" class="text-center p-2 border-b border-slate-300 dark:border-slate-600 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">Brand Profit</th>
                        </tr>
                        <tr>
                `;
                
                const groups = [
                    { bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
                    { bg: 'bg-pink-50/50 dark:bg-pink-900/10' },
                    { bg: 'bg-orange-50/50 dark:bg-orange-900/10' },
                    { bg: 'bg-purple-50/50 dark:bg-purple-900/10' },
                    { bg: 'bg-indigo-50/50 dark:bg-indigo-900/10' },
                    { bg: 'bg-cyan-50/50 dark:bg-cyan-900/10' },
                    { bg: 'bg-emerald-50/50 dark:bg-emerald-900/10' }
                ];
                groups.forEach(g => {
                    ['Q', 'P', 'N'].forEach(size => { tableHtml += `<th class="p-1 border-r border-b border-slate-300 dark:border-slate-600 w-16 text-center ${g.bg}">${size}</th>`; });
                });
                tableHtml += `</tr></thead><tbody class="divide-y divide-slate-200 dark:divide-slate-700">`;

                record.data.forEach(row => {
                    let bp = 0;
                    let tmpArr = {}, tdpArr = {};
                    ['q', 'p', 'n'].forEach(s => {
                        const m = parseFloat(row.mrp[s]) || 0;
                        const d = parseFloat(row.discount[s]) || 0;
                        const c = parseFloat(row.cost[s]) || 0;
                        const q = parseFloat(row.qty[s]) || 0;
                        const dq = row.dqty ? (parseFloat(row.dqty[s]) || 0) : 0;
                        tmpArr[s] = (m - c) * q;
                        tdpArr[s] = (d - c) * dq;
                        bp += tmpArr[s] + tdpArr[s];
                    });
                    
                    const tdText = (val) => `<td class="p-1 border-r border-slate-200 dark:border-slate-700 text-right">${val || ''}</td>`;
                    const tdMoney = (val, colorClass) => `<td class="p-1 border-r border-slate-200 dark:border-slate-700 text-right ${getColorClass(val, colorClass)}">${formatMoney(val)}</td>`;
                    
                    tableHtml += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td class="sticky-col bg-white dark:bg-darkCard p-1 border-r border-slate-200 dark:border-slate-700 font-bold z-10 text-xs">${row.name || '-'}</td>
                        ${tdText(row.mrp.q)}${tdText(row.mrp.p)}${tdText(row.mrp.n)}
                        ${tdText(row.discount.q)}${tdText(row.discount.p)}${tdText(row.discount.n)}
                        ${tdText(row.cost.q)}${tdText(row.cost.p)}${tdText(row.cost.n)}
                        ${tdText(row.qty.q)}${tdText(row.qty.p)}${tdText(row.qty.n)}
                        ${tdText(row.dqty ? row.dqty.q : '')}${tdText(row.dqty ? row.dqty.p : '')}${tdText(row.dqty ? row.dqty.n : '')}
                        ${tdMoney(tmpArr.q, 'bg-cyan-50/30 dark:bg-cyan-900/10')}${tdMoney(tmpArr.p, 'bg-cyan-50/30 dark:bg-cyan-900/10')}${tdMoney(tmpArr.n, 'bg-cyan-50/30 dark:bg-cyan-900/10')}
                        ${tdMoney(tdpArr.q, 'bg-emerald-50/30 dark:bg-emerald-900/10')}${tdMoney(tdpArr.p, 'bg-emerald-50/30 dark:bg-emerald-900/10')}${tdMoney(tdpArr.n, 'bg-emerald-50/30 dark:bg-emerald-900/10')}
                        ${tdMoney(bp, 'font-bold bg-amber-50/50 dark:bg-amber-900/20')}
                    </tr>`;
                });
                tableHtml += `</tbody></table></div>`;

                feedHtml += `
                <div class="bg-white dark:bg-darkCard p-5 rounded-xl shadow border border-slate-200 dark:border-darkBorder flex flex-col gap-4">
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
                                <i class="fa-solid fa-calendar-check"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">${record.date}</h3>
                                <p class="text-xs text-slate-500 dark:text-slate-400"><i class="fa-regular fa-clock"></i> ${timeStr}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="document.getElementById('table_${record.id}').classList.toggle('hidden')" class="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
                                <i class="fa-solid fa-table"></i> View Details
                            </button>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Brands</p>
                            <p class="text-xl font-bold text-slate-700 dark:text-slate-300">${totalBrands}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Bottles Sold</p>
                            <p class="text-xl font-bold text-amber-600 dark:text-amber-500">${totalBottles}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Grand Profit</p>
                            <p class="text-xl font-bold ${profitClass}">₹${formatMoney(grandTotalProfit)}</p>
                        </div>
                    </div>
                    
                    ${tableHtml}
                </div>
                `;
            });
            
            feed.innerHTML = feedHtml;
        }

        // Initialization
        window.onload = () => {
            if(localStorage.getItem('liquorDarkMode') === '1' || (!localStorage.getItem('liquorDarkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            }
            initHeaders();
            
            if(appData.length === 0) {
                addRow();
            } else {
                renderTable();
            }
        };
