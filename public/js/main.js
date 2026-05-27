document.addEventListener('DOMContentLoaded', () => {

    // ========== Добавление в корзину через AJAX ==========
    const addToCartForms = document.querySelectorAll('.add-to-cart-form');
    addToCartForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);

            try {
                const response = await fetch('/cart/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(formData).toString()
                });

                if (!response.ok) throw new Error('Ошибка добавления');

                // Показываем уведомление через модальное окно
                const modal = document.getElementById('dishModal');
                if (modal) {
                    document.getElementById('modal-name').textContent = 'Добавлено в корзину!';
                    document.getElementById('modal-description').textContent = 'Блюдо успешно добавлено.';
                    document.getElementById('modal-price').textContent = '';
                    modal.style.display = 'block';
                    setTimeout(() => { modal.style.display = 'none'; }, 2000);
                }
            } catch (err) {
                alert('Не удалось добавить блюдо');
                console.error(err);
            }
        });
    });

    // ========== Динамическое изменение статуса заказа (админ) ==========
    const statusForms = document.querySelectorAll('.status-change-form');
    statusForms.forEach(form => {
        const select = form.querySelector('select');
        if (select) {
            select.addEventListener('change', () => {
                form.requestSubmit(); // отправляет форму через submit
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const orderId = formData.get('orderId');
            const statusId = formData.get('statusId');
            const row = form.closest('tr');

            try {
                const response = await fetch('/admin/orders/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId, statusId })
                });

                if (!response.ok) throw new Error('Ошибка изменения статуса');

                const data = await response.json();

                // Обновляем текст статуса в строке
                const statusCell = row.querySelector('.status-cell');
                if (statusCell) statusCell.textContent = data.status_name;

                // Обновляем кнопку удаления: показываем, если статус 5 или 6
                const deleteCell = row.querySelector('.delete-cell');
                if (deleteCell) {
                    if (data.status_id === 5 || data.status_id === 6) {
                        deleteCell.innerHTML = `
                            <form action="/admin/orders/delete/${orderId}" method="POST"
                                  onsubmit="return confirm('Удалить заказ №${orderId} навсегда?');">
                                <button type="submit" class="btn" style="background-color: #a33;">Удалить</button>
                            </form>`;
                    } else {
                        deleteCell.innerHTML = '<span style="color: #666;">—</span>';
                    }
                }

                // Если статус стал "Отменён", можно обновить внешний вид строки
                if (data.status_id === 6) {
                    row.style.opacity = '0.6';
                } else {
                    row.style.opacity = '1';
                }

            } catch (err) {
                alert('Не удалось изменить статус');
                console.error(err);
            }
        });
    });

    // ========== Автообновление статусов на странице пользователя (polling) ==========
    if (window.location.pathname === '/orders') {
        setInterval(async () => {
            try {
                const response = await fetch('/orders/statuses');
                if (!response.ok) return;
                const statusList = await response.json();

                statusList.forEach(({ id, status_name }) => {
                    const cell = document.querySelector(`.order-status[data-order-id="${id}"]`);
                    if (cell) cell.textContent = status_name;
                });
            } catch (err) {
                console.error('Ошибка обновления статусов:', err);
            }
        }, 15000); // 15 секунд
    }

});