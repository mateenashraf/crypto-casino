/**
 * Contact form - UI only; submissions are not stored or transmitted.
 */
const ContactForm = (() => {
  function init() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();
      if (!name || !email || !message) {
        window.AppUI?.toast?.('Fill in all required fields', 'error');
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;

      window.AppUI?.toast?.('Message sent. Thank you for reaching out.', 'success');
      form.reset();

      if (btn) btn.disabled = false;
    });
  }

  return { init };
})();

window.ContactForm = ContactForm;
