// Main Javascript file for Kshetra Spaces

document.addEventListener('DOMContentLoaded', () => {
  // 1. Navigation Active Link Tracker
  const currentPath = window.location.pathname;
  const page = currentPath.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === page || (page === 'index.html' && href === '#') || (href === 'index.html' && page === '')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // 2. Shrinking Header on Scroll
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('shrink');
      } else {
        header.classList.remove('shrink');
      }
    });
  }

  // 3. Mobile Menu Toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', isOpen);
      // Toggle menu icons if using SVG
      const menuIcon = menuToggle.querySelector('svg');
      if (menuIcon) {
        if (isOpen) {
          // Change to Close 'X' icon path
          menuIcon.innerHTML = `<path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
        } else {
          // Change back to Burger menu icon path
          menuIcon.innerHTML = `<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
        }
      }
    });

    // Close menu when clicking links
    navMenu.addEventListener('click', (e) => {
      if (e.target.closest('.nav-link')) {
        navMenu.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        const menuIcon = menuToggle.querySelector('svg');
        if (menuIcon) {
          menuIcon.innerHTML = `<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
        }
      }
    });
  }

  // 4. Lightweight Fallback for Invoker Commands API (HTML button commandfor & command)
  if (!('commandForElement' in HTMLButtonElement.prototype)) {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button[commandfor]');
      if (!button) return;
      
      const targetId = button.getAttribute('commandfor');
      const command = button.getAttribute('command');
      const target = document.getElementById(targetId);
      
      if (!target) return;
      
      if (command === 'show-modal' && typeof target.showModal === 'function') {
        target.showModal();
        e.preventDefault();
      } else if (command === 'close' && typeof target.close === 'function') {
        target.close();
        e.preventDefault();
      } else if (command === 'toggle-popover' && typeof target.togglePopover === 'function') {
        target.togglePopover();
        e.preventDefault();
      } else if (command === 'show-popover' && typeof target.showPopover === 'function') {
        target.showPopover();
        e.preventDefault();
      } else if (command === 'hide-popover' && typeof target.hidePopover === 'function') {
        target.hidePopover();
        e.preventDefault();
      }
    });
  }

  // 5. Custom Backdrop Close (Light-Dismiss Fallback) for dialogs
  const dialogs = document.querySelectorAll('dialog');
  dialogs.forEach(dialog => {
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        dialog.close();
      }
    });
  });

  // 6. Lead Form Handling & Dynamic Dialog Success Alert
  const leadForms = document.querySelectorAll('form:not([method="dialog"])');
  leadForms.forEach(form => {
    // Avoid interfering with admin authentication forms
    if (form.id === 'login-form' || form.id === 'hero-form' || form.id === 'specs-form') {
      return;
    }
    
    form.addEventListener('submit', async (e) => {
      // If native form validation fails, let standard behavior handle it
      if (!form.checkValidity()) {
        return;
      }
      
      e.preventDefault(); // Prevent full page reload
      
      // Extract form data
      const formData = new FormData(form);
      const payload = {
        name: formData.get('name') || '',
        phone: formData.get('phone') || '',
        email: formData.get('email') || '',
        interest: formData.get('interest') || '',
        project: formData.get('project') || '',
        visitDate: formData.get('visitDate') || '',
        message: formData.get('message') || ''
      };
      
      // Close parent dialog if the form was inside one
      const parentDialog = form.closest('dialog');
      if (parentDialog) {
        parentDialog.close();
      }
      
      // Show custom success dialog alert
      showSuccessAlert(payload.name || 'Client');
      
      // Reset form immediately
      form.reset();

      // Post to Express backend leads collector
      try {
        await fetch('/api/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.warn('Lead submission failed to post to API. Fallback triggered.', err);
      }
    });
  });

  // Function to dynamically build and display a Success Dialog
  function showSuccessAlert(userName) {
    let successDialog = document.getElementById('success-dialog');
    if (!successDialog) {
      successDialog = document.createElement('dialog');
      successDialog.id = 'success-dialog';
      successDialog.innerHTML = `
        <div class="dialog-header">
          <h3 class="text-gold">Inquiry Received</h3>
          <button class="dialog-close" commandfor="success-dialog" command="close" aria-label="Close dialog">&times;</button>
        </div>
        <p style="margin-bottom: 1.5rem; text-wrap: pretty;">Thank you, <strong>${userName}</strong>! Your inquiry has been submitted. Our property advisor Himabindu will contact you within the next 24 hours to assist with your requirements.</p>
        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-gold" commandfor="success-dialog" command="close">Close</button>
        </div>
      `;
      document.body.appendChild(successDialog);
      
      // Add light-dismiss click listener for this dynamically added dialog
      successDialog.addEventListener('click', (e) => {
        const rect = successDialog.getBoundingClientRect();
        if (e.clientY < rect.top || e.clientY > rect.bottom || e.clientX < rect.left || e.clientX > rect.right) {
          successDialog.close();
        }
      });
    } else {
      // Update name text dynamically
      successDialog.querySelector('strong').textContent = userName;
    }
    
    successDialog.showModal();
  }

  // 7. Scroll Reveal Intersection Observer Helper
  function initRevealAnimation(container = document) {
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-active');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const revealElements = container.querySelectorAll('.reveal');
    revealElements.forEach(el => revealObserver.observe(el));
  }

  initRevealAnimation();

  // 8. Dynamic Content Hydration
  async function hydratePageContent() {
    try {
      const res = await fetch('/api/content');
      if (!res.ok) {
        console.warn('API content fetch failed, using fallback static HTML content.');
        return;
      }
      const data = await res.json();
      
      const currentPath = window.location.pathname;
      const page = currentPath.split('/').pop() || 'index.html';
      
      // A. Home Page Hydration
      if (page === 'index.html' || page === '') {
        const heroTitle = document.querySelector('.hero-title');
        const heroDesc = document.querySelector('.hero-desc');
        const heroBanner = document.querySelector('.hero-banner');
        
        if (heroTitle && data.hero.title) heroTitle.textContent = data.hero.title;
        if (heroDesc && data.hero.subtitle) heroDesc.textContent = data.hero.subtitle;
        if (heroBanner && data.hero.bgImage) {
          heroBanner.style.backgroundImage = `url('${data.hero.bgImage}')`;
        }
        
        const projectsGrid = document.querySelector('section[aria-labelledby="proj-heading"] .grid-layout');
        if (projectsGrid && data.projects) {
          renderProjectsGrid(projectsGrid, data.projects);
        }
      }
      
      // B. Projects Page Hydration
      if (page === 'projects.html') {
        const portfolioGrid = document.getElementById('portfolio-grid');
        if (portfolioGrid && data.projects) {
          renderProjectsGrid(portfolioGrid, data.projects, true);
          bindProjectFilters();
        }
      }
      
      // C. Villas Spotlight Hydration
      if (page === 'villas.html') {
        const titleEl = document.getElementById('villa-spotlight-title');
        const descEl = document.getElementById('villa-spotlight-desc');
        const specsEl = document.getElementById('villa-spotlight-specs');
        
        if (titleEl && data.villas_info.title) titleEl.textContent = data.villas_info.title;
        if (descEl && data.villas_info.description) descEl.textContent = data.villas_info.description;
        if (specsEl && data.villas_info.specs) {
          renderSpecsList(specsEl, data.villas_info.specs);
        }
      }
      
      // D. Apartments Spotlight Hydration
      if (page === 'apartments.html') {
        // Godrej Spotlight
        const godrejTitle = document.getElementById('apt-godrej-title-el');
        const godrejDesc = document.getElementById('apt-godrej-desc-el');
        const godrejSpecs = document.getElementById('apt-godrej-specs-el');
        
        if (data.apartments_info && data.apartments_info.godrej) {
          const godrejData = data.apartments_info.godrej;
          if (godrejTitle && godrejData.title) godrejTitle.textContent = godrejData.title;
          if (godrejDesc && godrejData.description) godrejDesc.textContent = godrejData.description;
          if (godrejSpecs && godrejData.specs) {
            renderSpecsList(godrejSpecs, godrejData.specs);
          }
        }
        
        // Bricks Spotlight
        const bricksTitle = document.getElementById('apt-bricks-title-el');
        const bricksDesc = document.getElementById('apt-bricks-desc-el');
        const bricksSpecs = document.getElementById('apt-bricks-specs-el');
        
        if (data.apartments_info && data.apartments_info.bricks) {
          const bricksData = data.apartments_info.bricks;
          if (bricksTitle && bricksData.title) bricksTitle.textContent = bricksData.title;
          if (bricksDesc && bricksData.description) bricksDesc.textContent = bricksData.description;
          if (bricksSpecs && bricksData.specs) {
            renderSpecsList(bricksSpecs, bricksData.specs);
          }
        }
      }
      
      // E. Plots Spotlight Hydration
      if (page === 'plots.html') {
        const titleEl = document.getElementById('plot-spotlight-title');
        const descEl = document.getElementById('plot-spotlight-desc');
        const specsEl = document.getElementById('plot-spotlight-specs');
        
        if (titleEl && data.plots_info.title) titleEl.textContent = data.plots_info.title;
        if (descEl && data.plots_info.description) descEl.textContent = data.plots_info.description;
        if (specsEl && data.plots_info.specs) {
          renderSpecsList(specsEl, data.plots_info.specs);
        }
      }
      
    } catch (err) {
      console.warn('Unable to reach backend API. Falling back to native static layout details.', err);
    }
  }

  // Helper: Render Project Cards dynamically
  function renderProjectsGrid(gridContainer, projects, includeCategoryAttr = false) {
    gridContainer.innerHTML = '';
    
    projects.forEach((proj, idx) => {
      const cardContainer = document.createElement('div');
      cardContainer.className = `card-container reveal delay-${(idx % 4) + 1}`;
      if (includeCategoryAttr) {
        cardContainer.classList.add('project-card-item');
        cardContainer.setAttribute('data-category', proj.category);
      }
      
      const badgeText = proj.category.charAt(0).toUpperCase() + proj.category.slice(1);
      
      cardContainer.innerHTML = `
        <article class="premium-card">
          <div class="card-image-wrapper">
            <img src="${proj.image}" alt="${proj.title} project image" class="card-image" loading="lazy">
            <span class="card-badge">${badgeText}</span>
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span style="display: inline-flex; align-items: center;">
                <svg class="svg-icon" style="width: 14px; height: 14px; margin-inline-end: 4px;" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${proj.location}
              </span>
              <span style="display: inline-flex; align-items: center;">
                <svg class="svg-icon" style="width: 14px; height: 14px; margin-inline-end: 4px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle></svg>
                ${proj.config}
              </span>
            </div>
            <h3 class="card-title">${proj.title}</h3>
            <p>${proj.description}</p>
            <div class="card-footer">
              <span class="card-price">${proj.price}</span>
              <button class="btn btn-gold" style="padding: 0.5rem 1rem; font-size: 0.85rem; min-block-size: auto; min-inline-size: auto;" commandfor="schedule-visit-dialog" command="show-modal">Schedule Visit</button>
            </div>
          </div>
        </article>
      `;
      gridContainer.appendChild(cardContainer);
    });
    
    // Re-initialize reveal transitions on newly appended cards
    initRevealAnimation(gridContainer);
  }

  // Helper: Render Specs list dynamically with gold check SVGs
  function renderSpecsList(listElement, specs) {
    const checkIcon = `<svg class="svg-icon" style="width: 16px; height: 16px; color: var(--gold-primary);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    listElement.innerHTML = specs.map(spec => `
      <li style="display: inline-flex; align-items: center; gap: 0.5rem;">
        ${checkIcon}
        <span>${spec}</span>
      </li>
    `).join('');
  }

  // Helper: Rebind filters for projects.html
  function bindProjectFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (filterBtns.length === 0) return;
    
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const filter = btn.getAttribute('data-filter');
        const cards = document.querySelectorAll('.project-card-item');
        
        cards.forEach(card => {
          const category = card.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // Execute Hydration
  hydratePageContent();
});

