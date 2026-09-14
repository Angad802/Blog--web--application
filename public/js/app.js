/**
 * Blog Web Application - Modern Client-Side Controller
 * Powers Dark/Light Theme, Real-Time Search, Filter Pills & Topic Chips,
 * Markdown Article Reader Modal with Scroll Progress, Live Editor Preview,
 * Draft Auto-Saving, Media Previews, Password Strength Meter, and Toasts.
 */

(function () {
    'use strict';

    // -------------------------------------------------------------
    // 1. THEME MANAGER (Dark & Light Modes)
    // -------------------------------------------------------------
    const initTheme = () => {
        const savedTheme = localStorage.getItem('blog_theme');
        // Default to professional white / light theme
        const activeTheme = savedTheme || 'light';

        document.documentElement.setAttribute('data-theme', activeTheme);
        updateThemeToggleIcons(activeTheme);

        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'light';
                const nextTheme = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', nextTheme);
                localStorage.setItem('blog_theme', nextTheme);
                updateThemeToggleIcons(nextTheme);
                showToast(`Switched to ${nextTheme === 'dark' ? '🌙 Dark' : '☀️ Light'} mode`, 'info');
            });
        });
    };

    const updateThemeToggleIcons = (theme) => {
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            const sunIcon = btn.querySelector('.sun-icon');
            const moonIcon = btn.querySelector('.moon-icon');
            if (sunIcon && moonIcon) {
                if (theme === 'dark') {
                    sunIcon.style.display = 'block';
                    moonIcon.style.display = 'none';
                    btn.setAttribute('aria-label', 'Switch to light mode');
                    btn.setAttribute('title', 'Switch to light mode');
                } else {
                    sunIcon.style.display = 'none';
                    moonIcon.style.display = 'block';
                    btn.setAttribute('aria-label', 'Switch to dark mode');
                    btn.setAttribute('title', 'Switch to dark mode');
                }
            }
        });
    };

    // -------------------------------------------------------------
    // 2. TOAST NOTIFICATION SYSTEM
    // -------------------------------------------------------------
    window.showToast = (message, type = 'default') => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;

        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (type === 'error') {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        } else {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }

        toast.innerHTML = `
            <span class="toast-icon">${iconSvg}</span>
            <span class="toast-msg">${message}</span>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });

        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3200);
    };

    // -------------------------------------------------------------
    // 3. LIGHTWEIGHT SECURE MARKDOWN FORMATTER
    // -------------------------------------------------------------
    const renderMarkdown = (rawText) => {
        if (!rawText) return '';

        // Escape HTML entities to prevent XSS
        let html = rawText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Fenced code blocks ```lang ... ```
        html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });

        // Inline code `code`
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Headings
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');

        // Blockquotes
        html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

        // Bold & Italics
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

        // Unordered lists
        html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        // Paragraphs: split by double newlines
        const blocks = html.split(/\n\s*\n/);
        return blocks
            .map(block => {
                const trimmed = block.trim();
                if (!trimmed) return '';
                if (trimmed.startsWith('<h2') || trimmed.startsWith('<h3') ||
                    trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote') ||
                    trimmed.startsWith('<ul') || trimmed.startsWith('<li')) {
                    return trimmed;
                }
                return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
            })
            .join('\n');
    };

    // -------------------------------------------------------------
    // 4. READING TIME CALCULATOR
    // -------------------------------------------------------------
    const calculateReadTime = (text) => {
        if (!text) return '1 min read';
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const minutes = Math.max(1, Math.ceil(words / 180));
        return `${minutes} min read`;
    };

    // -------------------------------------------------------------
    // 5. HOMEPAGE FEED: SEARCH, TOPIC CHIPS, FILTERS, VIEW SWITCH
    // -------------------------------------------------------------
    const initFeedControls = () => {
        const searchInput = document.getElementById('search-input');
        const clearSearchBtn = document.getElementById('clear-search-btn');
        const filterPills = document.querySelectorAll('.filter-pill');
        const topicChips = document.querySelectorAll('.topic-chip');
        const footerTopicLinks = document.querySelectorAll('.footer-topic-link');
        const postList = document.getElementById('postlist');
        const viewToggles = document.querySelectorAll('.view-btn');
        const countDisplay = document.querySelector('.posts-count');

        if (!postList) return;

        const cards = Array.from(postList.querySelectorAll('.blog-card'));

        // Initialize cards with calculated read times & bookmarks
        cards.forEach(card => {
            const contentEl = card.querySelector('.card-content');
            const readTimeEl = card.querySelector('.read-time-badge');
            if (contentEl && readTimeEl) {
                readTimeEl.textContent = calculateReadTime(contentEl.textContent);
            }

            const postId = card.dataset.id;
            const bookmarkBtn = card.querySelector('.btn-bookmark');
            if (bookmarkBtn && postId) {
                const isBookmarked = localStorage.getItem(`bookmark_${postId}`) === 'true';
                if (isBookmarked) bookmarkBtn.classList.add('active');

                bookmarkBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentStatus = bookmarkBtn.classList.contains('active');
                    if (currentStatus) {
                        bookmarkBtn.classList.remove('active');
                        localStorage.removeItem(`bookmark_${postId}`);
                        showToast('Removed from saved bookmarks', 'default');
                    } else {
                        bookmarkBtn.classList.add('active');
                        localStorage.setItem(`bookmark_${postId}`, 'true');
                        showToast('Saved to your bookmarks! 🔖', 'success');
                    }
                    if (currentFilter === 'saved') {
                        applyFilter();
                    }
                });
            }
        });

        // Filter state
        let currentQuery = '';
        let currentFilter = 'all'; // all, media, saved
        let currentTopic = 'all'; // all, technology, design, writing, code, ideas

        const applyFilter = () => {
            let visibleCount = 0;

            cards.forEach(card => {
                const title = (card.querySelector('.card-title')?.textContent || '').toLowerCase();
                const content = (card.querySelector('.card-content')?.textContent || '').toLowerCase();
                const author = (card.querySelector('.author-name')?.textContent || '').toLowerCase();
                const cardTopic = (card.dataset.topic || '').toLowerCase();
                const hasMedia = !!card.querySelector('.post-media, .post-media-video, .card-images-section, .card-videos-section');
                const isBookmarked = card.querySelector('.btn-bookmark')?.classList.contains('active');

                const matchesQuery = !currentQuery ||
                    title.includes(currentQuery) ||
                    content.includes(currentQuery) ||
                    author.includes(currentQuery);

                let matchesFilter = true;
                if (currentFilter === 'media') {
                    matchesFilter = hasMedia;
                } else if (currentFilter === 'saved') {
                    matchesFilter = isBookmarked;
                }

                let matchesTopic = true;
                if (currentTopic !== 'all') {
                    matchesTopic = cardTopic.includes(currentTopic) ||
                                   title.includes(currentTopic) ||
                                   content.includes(currentTopic);
                }

                if (matchesQuery && matchesFilter && matchesTopic) {
                    card.style.display = '';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            if (countDisplay) {
                countDisplay.textContent = `${visibleCount} ${visibleCount === 1 ? 'Story' : 'Stories'}`;
            }

            // Handle empty search / filter state
            let noMatchEl = document.getElementById('no-search-results');
            if (visibleCount === 0 && cards.length > 0) {
                if (!noMatchEl) {
                    noMatchEl = document.createElement('div');
                    noMatchEl.id = 'no-search-results';
                    noMatchEl.className = 'no-search-box';
                    noMatchEl.innerHTML = `
                        <div class="no-search-icon">🔍</div>
                        <h3>No matching stories found</h3>
                        <p style="color: var(--text-secondary); margin-top: 6px;">Try adjusting your search terms or filter selection.</p>
                        <button class="btn-hero-secondary btn-reset-search" id="reset-filter-btn" style="margin-top: 18px;">Reset All Filters</button>
                    `;
                    postList.parentNode.insertBefore(noMatchEl, postList.nextSibling);
                    document.getElementById('reset-filter-btn')?.addEventListener('click', resetAllFilters);
                }
                noMatchEl.style.display = 'block';
            } else if (noMatchEl) {
                noMatchEl.style.display = 'none';
            }
        };

        const resetAllFilters = () => {
            if (searchInput) searchInput.value = '';
            currentQuery = '';
            currentFilter = 'all';
            currentTopic = 'all';

            filterPills.forEach(p => p.classList.remove('active'));
            document.querySelector('.filter-pill[data-filter="all"]')?.classList.add('active');

            topicChips.forEach(c => c.classList.remove('active'));
            document.querySelector('.topic-chip[data-topic="all"]')?.classList.add('active');

            if (clearSearchBtn) clearSearchBtn.style.display = 'none';
            applyFilter();
        };

        // Real-time search input listener
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentQuery = e.target.value.trim().toLowerCase();
                if (clearSearchBtn) {
                    clearSearchBtn.style.display = currentQuery.length > 0 ? 'flex' : 'none';
                }
                applyFilter();
            });

            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    clearSearchBtn.style.display = 'none';
                    currentQuery = '';
                    applyFilter();
                    searchInput.focus();
                });
            }
        }

        // Global keyboard shortcut '/' to focus search bar
        document.addEventListener('keydown', (e) => {
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (e.key === '/' && activeTag !== 'input' && activeTag !== 'textarea') {
                if (searchInput) {
                    e.preventDefault();
                    searchInput.focus();
                    searchInput.select();
                }
            } else if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.value = '';
                if (clearSearchBtn) clearSearchBtn.style.display = 'none';
                currentQuery = '';
                applyFilter();
                searchInput.blur();
            }
        });

        // Filter pills (All, With Media, Saved)
        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                currentFilter = pill.dataset.filter || 'all';
                applyFilter();
            });
        });

        // Topic chips (Technology, Design, Writing, Code, Ideas)
        topicChips.forEach(chip => {
            chip.addEventListener('click', () => {
                topicChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentTopic = (chip.dataset.topic || 'all').toLowerCase();
                applyFilter();
            });
        });

        // Footer topic link clicks
        footerTopicLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const topic = (link.dataset.topic || '').toLowerCase();
                if (topic) {
                    topicChips.forEach(c => {
                        if (c.dataset.topic === topic) {
                            c.click();
                        }
                    });
                }
            });
        });

        // View toggle (Grid vs List)
        viewToggles.forEach(btn => {
            btn.addEventListener('click', () => {
                viewToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const viewMode = btn.dataset.view;
                if (viewMode === 'list') {
                    postList.classList.add('list-view');
                } else {
                    postList.classList.remove('list-view');
                }
                localStorage.setItem('blog_view_mode', viewMode);
            });
        });

        // Restore saved view mode
        const savedView = localStorage.getItem('blog_view_mode');
        if (savedView === 'list') {
            document.querySelector('.view-btn[data-view="list"]')?.click();
        }
    };

    // -------------------------------------------------------------
    // 6. ARTICLE READER MODAL (WITH MARKDOWN & SCROLL PROGRESS)
    // -------------------------------------------------------------
    const initReaderModal = () => {
        const modal = document.getElementById('reader-modal');
        if (!modal) return;

        const modalClose = modal.querySelector('.modal-close-btn');
        const modalBackdrop = modal.querySelector('.modal-backdrop');
        const modalScrollArea = document.getElementById('modal-scroll-area');
        const progressBar = document.getElementById('reader-progress-bar');
        const modalTitle = modal.querySelector('.modal-title');
        const modalAuthor = modal.querySelector('.modal-author');
        const modalDate = modal.querySelector('.modal-date');
        const modalReadTime = modal.querySelector('.modal-readtime');
        const modalBody = document.getElementById('modal-article-content');
        const modalMedia = modal.querySelector('.modal-media-container');
        const modalShareBtn = document.getElementById('modal-share-trigger');
        const fontSizeBtns = modal.querySelectorAll('.btn-font-size');

        let currentActiveUrl = '';

        const openReader = (card) => {
            const title = card.querySelector('.card-title')?.textContent.trim() || 'Story';
            const author = card.querySelector('.author-name')?.textContent.trim() || 'Author';
            const date = card.querySelector('.date-badge')?.textContent.trim() || '';
            const rawContent = card.querySelector('.full-content-source')?.textContent ||
                               card.querySelector('.card-content')?.textContent || '';
            const postId = card.dataset.id;

            currentActiveUrl = `${window.location.origin}/#post-${postId}`;

            if (modalTitle) modalTitle.textContent = title;
            if (modalAuthor) modalAuthor.textContent = author;
            if (modalDate) modalDate.textContent = date;
            if (modalReadTime) modalReadTime.textContent = calculateReadTime(rawContent);

            // Render rich markdown
            if (modalBody) {
                modalBody.innerHTML = renderMarkdown(rawContent);
            }

            if (modalMedia) {
                modalMedia.innerHTML = '';
                const sourceEl = card.querySelector('.full-content-source');
                let imgList = [];
                let vidList = [];

                if (sourceEl) {
                    try {
                        const rawImgs = sourceEl.getAttribute('data-images');
                        if (rawImgs) {
                            const parsed = JSON.parse(rawImgs);
                            if (Array.isArray(parsed)) imgList = parsed.filter(Boolean);
                        }
                    } catch (e) {}
                    if (imgList.length === 0 && sourceEl.dataset.image) {
                        imgList = [sourceEl.dataset.image];
                    }

                    try {
                        const rawVids = sourceEl.getAttribute('data-videos');
                        if (rawVids) {
                            const parsed = JSON.parse(rawVids);
                            if (Array.isArray(parsed)) vidList = parsed.filter(Boolean);
                        }
                    } catch (e) {}
                    if (vidList.length === 0 && sourceEl.dataset.video) {
                        vidList = [sourceEl.dataset.video];
                    }
                }

                // Fallbacks from DOM
                if (imgList.length === 0) {
                    const foundImgs = card.querySelectorAll('.card-images-section img, .post-media img');
                    foundImgs.forEach(img => {
                        const src = img.getAttribute('src');
                        if (src && !imgList.includes(src)) imgList.push(src);
                    });
                }
                if (vidList.length === 0) {
                    const foundVids = card.querySelectorAll('.card-videos-section video, .post-media-video video');
                    foundVids.forEach(v => {
                        const src = v.querySelector('source')?.getAttribute('src') || v.getAttribute('src');
                        if (src && !vidList.includes(src)) vidList.push(src);
                    });
                }

                if (imgList.length > 0 || vidList.length > 0) {
                    let mediaHtml = '<div class="modal-media-stack">';

                    // Render all images
                    if (imgList.length > 0) {
                        mediaHtml += `
                            <div class="modal-images-block">
                                <div class="modal-gallery-grid count-${Math.min(imgList.length, 4)}">
                                    ${imgList.map((img, i) => `
                                        <div class="modal-gallery-item">
                                            <img src="${img}" alt="${title} image ${i+1}" class="modal-image" loading="lazy">
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }

                    // Render all videos
                    if (vidList.length > 0) {
                        mediaHtml += `
                            <div class="modal-videos-block">
                                ${vidList.map((vid, i) => `
                                    <div class="modal-video-wrap">
                                        <video controls playsinline class="modal-video-player" preload="metadata">
                                            <source src="${vid}" type="video/mp4">
                                            Your browser does not support HTML5 video.
                                        </video>
                                        ${vidList.length > 1 ? `<span class="modal-video-label">🎬 Video ${i+1}</span>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }

                    mediaHtml += '</div>';
                    modalMedia.innerHTML = mediaHtml;
                    modalMedia.style.display = 'block';
                } else {
                    modalMedia.style.display = 'none';
                }
            }

            // Reset scroll & progress bar
            if (modalScrollArea) modalScrollArea.scrollTop = 0;
            if (progressBar) progressBar.style.width = '0%';

            modal.classList.add('modal-open');
            document.body.style.overflow = 'hidden';
        };

        const closeReader = () => {
            modal.classList.remove('modal-open');
            document.body.style.overflow = '';
            modal.querySelectorAll('video').forEach(v => v.pause());
        };

        if (modalClose) modalClose.addEventListener('click', closeReader);
        if (modalBackdrop) modalBackdrop.addEventListener('click', closeReader);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('modal-open')) {
                closeReader();
            }
        });

        // Reading progress tracking
        if (modalScrollArea && progressBar) {
            modalScrollArea.addEventListener('scroll', () => {
                const scrollTop = modalScrollArea.scrollTop;
                const scrollHeight = modalScrollArea.scrollHeight - modalScrollArea.clientHeight;
                if (scrollHeight > 0) {
                    const percent = Math.min(100, Math.round((scrollTop / scrollHeight) * 100));
                    progressBar.style.width = `${percent}%`;
                }
            });
        }

        // Font size adjustments in reader modal
        fontSizeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                fontSizeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const size = btn.dataset.size;
                if (modalBody) {
                    modalBody.classList.remove('font-sm', 'font-lg');
                    if (size === 'sm') modalBody.classList.add('font-sm');
                    if (size === 'lg') modalBody.classList.add('font-lg');
                }
            });
        });

        // Trigger clicks for reader modal
        document.querySelectorAll('.btn-read-modal, .card-read-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const card = trigger.closest('.blog-card');
                if (card) openReader(card);
            });
        });

        // Share button inside modal
        if (modalShareBtn) {
            modalShareBtn.addEventListener('click', () => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(currentActiveUrl || window.location.href).then(() => {
                        showToast('Story link copied to clipboard! 📋', 'success');
                    }).catch(() => {
                        showToast('Could not copy link', 'error');
                    });
                }
            });
        }

        // Quick share on cards
        document.querySelectorAll('.btn-quick-share').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const card = btn.closest('.blog-card');
                const postId = card ? card.dataset.id : '';
                const shareUrl = `${window.location.origin}/#post-${postId}`;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        showToast('Story link copied to clipboard! 🔗', 'success');
                    });
                }
            });
        });
    };

    // -------------------------------------------------------------
    // 7. CREATOR STUDIO & EDITOR (`modify.ejs`)
    // -------------------------------------------------------------
    const initEditorControls = () => {
        const contentTextarea = document.getElementById('content');
        const titleInput = document.getElementById('title');
        const wordCountDisplay = document.getElementById('editor-word-count');
        const readTimeDisplay = document.getElementById('editor-read-time');
        const draftStatus = document.getElementById('draft-status');
        const imageInput = document.getElementById('image');
        const videoInput = document.getElementById('video');
        const imageDropzone = document.getElementById('image-dropzone');
        const videoDropzone = document.getElementById('video-dropzone');
        const imagePreviewBox = document.getElementById('image-preview-container');
        const videoPreviewBox = document.getElementById('video-preview-container');
        const tabWrite = document.getElementById('tab-write');
        const tabPreview = document.getElementById('tab-preview');
        const writeView = document.getElementById('editor-write-view');
        const previewView = document.getElementById('editor-preview-view');
        const livePreviewTitle = document.getElementById('preview-title');
        const livePreviewBody = document.getElementById('preview-body');
        const categoryChips = document.querySelectorAll('#editor-category-chips .category-chip-option');

        if (!contentTextarea && !titleInput) return;

        // Topic chips selection in creator studio
        categoryChips.forEach(chip => {
            chip.addEventListener('click', () => {
                categoryChips.forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
            });
        });

        // Word count & read time live updates
        const updateWordCount = () => {
            const text = contentTextarea ? contentTextarea.value.trim() : '';
            const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
            if (wordCountDisplay) {
                wordCountDisplay.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
            }
            if (readTimeDisplay) {
                readTimeDisplay.textContent = calculateReadTime(text);
            }
        };

        if (contentTextarea) {
            contentTextarea.addEventListener('input', updateWordCount);
            updateWordCount();
        }

        // Draft auto-save in localStorage for new post
        const isNewPost = !!document.getElementById('newpostform');
        if (isNewPost && titleInput && contentTextarea) {
            // Restore draft if available
            const savedDraftTitle = localStorage.getItem('draft_title');
            const savedDraftContent = localStorage.getItem('draft_content');

            if (!titleInput.value && savedDraftTitle) {
                titleInput.value = savedDraftTitle;
            }
            if (!contentTextarea.value && savedDraftContent) {
                contentTextarea.value = savedDraftContent;
                updateWordCount();
            }

            let saveTimeout;
            const autoSaveDraft = () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    localStorage.setItem('draft_title', titleInput.value);
                    localStorage.setItem('draft_content', contentTextarea.value);
                    if (draftStatus) {
                        draftStatus.innerHTML = `<span>●</span> <span>Draft saved locally</span>`;
                        draftStatus.style.color = 'var(--color-success)';
                    }
                }, 1000);
            };

            titleInput.addEventListener('input', autoSaveDraft);
            contentTextarea.addEventListener('input', autoSaveDraft);

            // Clear draft upon submit
            document.getElementById('newpostform')?.addEventListener('submit', () => {
                localStorage.removeItem('draft_title');
                localStorage.removeItem('draft_content');
            });
        }

        // Editor tab toggle (Write vs Live Preview)
        if (tabWrite && tabPreview && writeView && previewView) {
            tabWrite.addEventListener('click', () => {
                tabWrite.classList.add('active');
                tabPreview.classList.remove('active');
                writeView.style.display = 'block';
                previewView.style.display = 'none';
            });

            tabPreview.addEventListener('click', () => {
                tabPreview.classList.add('active');
                tabWrite.classList.remove('active');
                writeView.style.display = 'none';
                previewView.style.display = 'block';

                if (livePreviewTitle) {
                    livePreviewTitle.textContent = titleInput?.value.trim() || 'Untitled Story';
                }
                if (livePreviewBody) {
                    const raw = contentTextarea?.value.trim() || 'No story content entered yet...';
                    livePreviewBody.innerHTML = renderMarkdown(raw);
                }
            });
        }

        // Setup Drag & Drop Visuals and File Assignment on Dropzones
        [
            { dropzone: imageDropzone, input: imageInput },
            { dropzone: videoDropzone, input: videoInput }
        ].forEach(({ dropzone, input }) => {
            if (!dropzone || !input) return;

            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.add('dragover');
                });
            });

            ['dragleave'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.remove('dragover');
                });
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    input.files = e.dataTransfer.files;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });

        // Image files preview (multi-file support)
        if (imageInput && imagePreviewBox) {
            imageInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) {
                    imagePreviewBox.innerHTML = `
                        <div class="multi-preview-header">
                            <span class="preview-count-label">🖼️ ${files.length} Photo${files.length > 1 ? 's' : ''} Selected</span>
                            <button type="button" class="btn-clear-all-previews" id="btn-clear-all-imgs">✕ Clear All</button>
                        </div>
                        <div class="multi-preview-grid"></div>
                    `;
                    const grid = imagePreviewBox.querySelector('.multi-preview-grid');

                    files.forEach((file, index) => {
                        const itemCard = document.createElement('div');
                        itemCard.className = 'preview-card-item';
                        itemCard.dataset.index = index;

                        const reader = new FileReader();
                        reader.onload = (event) => {
                            itemCard.innerHTML = `
                                <div class="preview-thumb-wrap">
                                    <img src="${event.target.result}" alt="Preview ${index + 1}" class="live-preview-img">
                                </div>
                                <div class="preview-card-info">
                                    <span class="file-name" title="${file.name}">${file.name}</span>
                                    <span class="file-size">(${(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                                </div>
                            `;
                        };
                        reader.readAsDataURL(file);
                        grid.appendChild(itemCard);
                    });

                    imagePreviewBox.style.display = 'block';

                    document.getElementById('btn-clear-all-imgs')?.addEventListener('click', () => {
                        imageInput.value = '';
                        imagePreviewBox.innerHTML = '';
                        imagePreviewBox.style.display = 'none';
                    });
                } else {
                    imagePreviewBox.innerHTML = '';
                    imagePreviewBox.style.display = 'none';
                }
            });
        }

        // Video files preview (multi-file support)
        let activeVideoUrls = [];
        if (videoInput && videoPreviewBox) {
            videoInput.addEventListener('change', (e) => {
                activeVideoUrls.forEach(url => URL.revokeObjectURL(url));
                activeVideoUrls = [];

                const files = Array.from(e.target.files || []);
                if (files.length > 0) {
                    videoPreviewBox.innerHTML = `
                        <div class="multi-preview-header">
                            <span class="preview-count-label">🎬 ${files.length} Video${files.length > 1 ? 's' : ''} Selected</span>
                            <button type="button" class="btn-clear-all-previews" id="btn-clear-all-vids">✕ Clear All</button>
                        </div>
                        <div class="multi-preview-grid"></div>
                    `;
                    const grid = videoPreviewBox.querySelector('.multi-preview-grid');

                    files.forEach((file, index) => {
                        const vidUrl = URL.createObjectURL(file);
                        activeVideoUrls.push(vidUrl);

                        const itemCard = document.createElement('div');
                        itemCard.className = 'preview-card-item preview-video-card';
                        itemCard.dataset.index = index;
                        itemCard.innerHTML = `
                            <div class="preview-video-wrap">
                                <video controls class="live-preview-video" preload="metadata">
                                    <source src="${vidUrl}" type="${file.type || 'video/mp4'}">
                                    Your browser does not support video.
                                </video>
                            </div>
                            <div class="preview-card-info">
                                <span class="file-name" title="${file.name}">${file.name}</span>
                                <span class="file-size">(${(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                            </div>
                        `;
                        grid.appendChild(itemCard);
                    });

                    videoPreviewBox.style.display = 'block';

                    document.getElementById('btn-clear-all-vids')?.addEventListener('click', () => {
                        videoInput.value = '';
                        activeVideoUrls.forEach(url => URL.revokeObjectURL(url));
                        activeVideoUrls = [];
                        videoPreviewBox.innerHTML = '';
                        videoPreviewBox.style.display = 'none';
                    });
                } else {
                    videoPreviewBox.innerHTML = '';
                    videoPreviewBox.style.display = 'none';
                }
            });
        }

        // Formatting toolbar buttons
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!contentTextarea) return;
                const format = btn.dataset.format;
                const start = contentTextarea.selectionStart;
                const end = contentTextarea.selectionEnd;
                const text = contentTextarea.value;
                const selection = text.substring(start, end);

                let replacement = '';
                switch (format) {
                    case 'bold':
                        replacement = `**${selection || 'bold text'}**`;
                        break;
                    case 'italic':
                        replacement = `*${selection || 'italic text'}*`;
                        break;
                    case 'h2':
                        replacement = `\n## ${selection || 'Subheading'}\n`;
                        break;
                    case 'quote':
                        replacement = `\n> ${selection || 'Quote excerpt'}\n`;
                        break;
                    case 'bullet':
                        replacement = `\n- ${selection || 'List item'}\n`;
                        break;
                    case 'code':
                        replacement = selection.includes('\n') 
                            ? `\n\`\`\`\n${selection || 'code block'}\n\`\`\`\n` 
                            : `\`${selection || 'code'}\``;
                        break;
                }

                contentTextarea.setRangeText(replacement, start, end, 'end');
                contentTextarea.focus();
                updateWordCount();
            });
        });
    };

    // -------------------------------------------------------------
    // 8. AUTH PAGES: PASSWORD VISIBILITY & STRENGTH METER
    // -------------------------------------------------------------
    const initAuthFeatures = () => {
        // Password visibility toggles
        document.querySelectorAll('.password-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = btn.closest('.input-wrapper')?.querySelector('input');
                if (!input) return;

                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';

                const eyeOpen = btn.querySelector('.eye-open');
                const eyeClosed = btn.querySelector('.eye-closed');
                if (eyeOpen && eyeClosed) {
                    eyeOpen.style.display = isPassword ? 'none' : 'block';
                    eyeClosed.style.display = isPassword ? 'block' : 'none';
                }
            });
        });

        // Password strength meter
        const regPasswordInput = document.getElementById('password');
        const strengthBar = document.getElementById('password-strength-bar');
        const strengthText = document.getElementById('password-strength-text');

        if (regPasswordInput && strengthBar && strengthText) {
            regPasswordInput.addEventListener('input', () => {
                const val = regPasswordInput.value;
                let score = 0;
                if (val.length >= 6) score += 25;
                if (val.length >= 10) score += 25;
                if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score += 25;
                if (/[^A-Za-z0-9]/.test(val)) score += 25;

                strengthBar.style.width = `${score}%`;

                if (score === 0) {
                    strengthBar.style.backgroundColor = 'transparent';
                    strengthText.textContent = '';
                } else if (score <= 25) {
                    strengthBar.style.backgroundColor = 'var(--color-danger)';
                    strengthText.textContent = 'Weak';
                    strengthText.style.color = 'var(--color-danger)';
                } else if (score <= 50) {
                    strengthBar.style.backgroundColor = 'var(--color-warning)';
                    strengthText.textContent = 'Medium';
                    strengthText.style.color = 'var(--color-warning)';
                } else if (score <= 75) {
                    strengthBar.style.backgroundColor = 'var(--brand-primary)';
                    strengthText.textContent = 'Good';
                    strengthText.style.color = 'var(--brand-primary)';
                } else {
                    strengthBar.style.backgroundColor = 'var(--color-success)';
                    strengthText.textContent = 'Strong';
                    strengthText.style.color = 'var(--color-success)';
                }
            });
        }
    };

    // -------------------------------------------------------------
    // 9. NAVIGATION & SITE UTILITIES
    // -------------------------------------------------------------
    const initNavigation = () => {
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileDrawer = document.getElementById('mobile-nav-drawer');

        if (mobileMenuBtn && mobileDrawer) {
            mobileMenuBtn.addEventListener('click', () => {
                const isOpen = mobileDrawer.classList.contains('drawer-open');
                if (isOpen) {
                    mobileDrawer.classList.remove('drawer-open');
                } else {
                    mobileDrawer.classList.add('drawer-open');
                }
            });

            document.addEventListener('click', (e) => {
                if (!mobileMenuBtn.contains(e.target) && !mobileDrawer.contains(e.target)) {
                    mobileDrawer.classList.remove('drawer-open');
                }
            });
        }

        // Back to top floating button
        const backToTop = document.getElementById('back-to-top');
        if (backToTop) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 320) {
                    backToTop.classList.add('visible');
                } else {
                    backToTop.classList.remove('visible');
                }
            });

            backToTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // Newsletter subscription feedback
        const newsletterForm = document.getElementById('newsletter-form');
        if (newsletterForm) {
            newsletterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const emailInput = newsletterForm.querySelector('input[type="email"]');
                if (emailInput && emailInput.value) {
                    showToast('🎉 Thank you for subscribing to Blog App digest!', 'success');
                    emailInput.value = '';
                }
            });
        }
    };

    // -------------------------------------------------------------
    // INITIALIZATION
    // -------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initFeedControls();
        initReaderModal();
        initEditorControls();
        initAuthFeatures();
        initNavigation();
    });

})();
