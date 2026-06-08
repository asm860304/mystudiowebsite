document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const modal = document.getElementById('video-modal');
    const modalVideo = document.getElementById('modal-video');

    document.querySelectorAll('.case-card[data-video]').forEach(card => {
      card.addEventListener('click', () => {
        modalVideo.src = card.dataset.video;
        modal.classList.add('active');
        modalVideo.play();
      });
    });

    document.querySelector('.video-modal-overlay').addEventListener('click', closeModal);
    document.querySelector('.video-modal-close').addEventListener('click', closeModal);

    function closeModal() {
      modal.classList.remove('active');
      modalVideo.pause();
      modalVideo.src = '';
    }
