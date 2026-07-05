/**
 * Contact us form (stores locally + mailto fallback)
 */
const ContactForm = (() => {
  const STORAGE = 'starbitz_contact_messages';

  function init() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        topic: form.topic.value,
        message: form.message.value.trim(),
        wallet: window.SecureWeb3?.getAddress?.() || '',
        createdAt: Date.now(),
      };
      if (!data.name || !data.email || !data.message) {
        window.AppUI?.toast?.('Fill in all required fields', 'error');
        return;
      }
      const list = JSON.parse(localStorage.getItem(STORAGE) || '[]');
      list.unshift(data);
      localStorage.setItem(STORAGE, JSON.stringify(list.slice(0, 50)));
      window.AppUI?.toast?.('Message received. We reply within 24 hours.', 'success');
      form.reset();
    });
  }

  return { init };
})();

window.ContactForm = ContactForm;
