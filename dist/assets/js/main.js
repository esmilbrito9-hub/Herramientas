
document.addEventListener("DOMContentLoaded", () => {

    // Animate only elements entering the viewport. Browsers without
    // IntersectionObserver keep the page fully visible and functional.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!reducedMotion.matches && "IntersectionObserver" in window) {
        const revealTargets = document.querySelectorAll(
            ".hero-text > *, .hero-visual, .section-heading, .category-card, " +
            ".about-content > *, .learning-content > *, .lesson-header .container > *, " +
            ".lesson-content > *, .featured-learning, .subcategory-section, .credit-card"
        );
        revealTargets.forEach((element, index) => {
            element.classList.add("reveal-on-scroll");
            if (element.classList.contains("category-card")) {
                element.style.setProperty("--reveal-delay", `${Math.min(index % 8, 5) * 55}ms`);
            }
        });
        document.documentElement.classList.add("motion-ready");
        const revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });
        revealTargets.forEach(element => revealObserver.observe(element));
    }

    const randomLessonButton = document.getElementById("randomLessonButton");
    const lessonSuggestions = document.getElementById("lessonSuggestions");
    const suggestedLesson = document.getElementById("suggestedLesson");
    const randomLessonStatus = document.getElementById("randomLessonStatus");
    if (randomLessonButton && lessonSuggestions && suggestedLesson && randomLessonStatus) {
        let suggestions = [];
        try { suggestions = JSON.parse(lessonSuggestions.textContent); } catch (_) { suggestions = []; }
        let previousIndex = -1;
        randomLessonButton.addEventListener("click", () => {
            if (!suggestions.length) return;
            let selectedIndex = Math.floor(Math.random() * suggestions.length);
            if (suggestions.length > 1 && selectedIndex === previousIndex) {
                selectedIndex = (selectedIndex + 1) % suggestions.length;
            }
            previousIndex = selectedIndex;
            const lesson = suggestions[selectedIndex];
            suggestedLesson.href = lesson.url;
            suggestedLesson.textContent = `${lesson.title} →`;
            suggestedLesson.hidden = false;
            randomLessonStatus.textContent = lesson.description;
        });
    }

    // ========================================
    // MENÚ DE NAVEGACIÓN
    // ========================================

    const menuToggle = document.getElementById("menuToggle");
    const navMenu = document.getElementById("navMenu");

    if (menuToggle && navMenu) {

        menuToggle.addEventListener("click", () => {
            const isOpen = navMenu.classList.toggle("open");

            menuToggle.classList.toggle("active", isOpen);
            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });

        // Cerrar el menú al seleccionar un enlace
        navMenu.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("open");
                menuToggle.classList.remove("active");
                menuToggle.setAttribute("aria-expanded", "false");
            });
        });

        // Cerrar el menú al pulsar Escape
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                navMenu.classList.remove("open");
                menuToggle.classList.remove("active");
                menuToggle.setAttribute("aria-expanded", "false");
            }
        });
    }


    // ========================================
    // BUSCADOR DE CATEGORÍAS
    // ========================================

    const searchInput = document.getElementById("categorySearch");
    const searchButton = document.getElementById("searchButton");
    const categoryCards = document.querySelectorAll(".category-card");
    const noResults = document.getElementById("noResults");
    const resultList = document.getElementById("siteSearchResults");
    const searchIndexElement = document.getElementById("searchIndex");
    const searchMessage = document.getElementById("searchMessage");
    let searchIndex = [];
    if (searchIndexElement) {
        try { searchIndex = JSON.parse(searchIndexElement.textContent); } catch (_) { searchIndex = []; }
    }

    function searchCategories() {

        if (!searchInput || categoryCards.length === 0) {
            return;
        }

        const searchText = searchInput.value
            .toLowerCase()
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        categoryCards.forEach(card => {

            const cardText = (
                card.dataset.search || card.textContent
            )
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

            const matches = cardText.includes(searchText);

            card.hidden = !matches;

        });

        const matchingItems = searchText
            ? searchIndex.filter(item => `${item.title} ${item.description} ${item.search || ""}`
                .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(searchText))
            : [];
        if (resultList) {
            resultList.replaceChildren();
            matchingItems.slice(0, 12).forEach(item => {
                const li = document.createElement("li");
                const link = document.createElement("a");
                const description = document.createElement("p");
                link.href = item.url;
                link.textContent = item.title;
                description.textContent = item.description;
                li.append(link, description);
                resultList.appendChild(li);
            });
            resultList.hidden = !searchText || matchingItems.length === 0;
        }

        if (noResults) {
            noResults.hidden = !searchText || matchingItems.length !== 0;
        }
        if (searchMessage) {
            const isEnglish = document.documentElement.lang === "en";
            searchMessage.textContent = !searchText ? "" : isEnglish
                ? `${matchingItems.length} result${matchingItems.length === 1 ? "" : "s"} for “${searchInput.value.trim()}”.`
                : `${matchingItems.length} resultado${matchingItems.length === 1 ? "" : "s"} para «${searchInput.value.trim()}».`;
        }
    }

    if (searchInput) {
        searchInput.addEventListener("input", searchCategories);

        searchInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                searchCategories();
            }
            if (event.key === "Escape") {
                searchInput.value = "";
                searchCategories();
            }
        });
    }

    document.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            if (searchInput) {
                event.preventDefault();
                searchInput.focus();
            }
        }
    });

    const themeToggle = document.getElementById("themeToggle");
    let savedTheme = "light";
    try { savedTheme = localStorage.getItem("nexora-theme") || "light"; } catch (_) { /* Storage may be disabled. */ }
    if (savedTheme === "dark") document.documentElement.dataset.theme = "dark";
    if (themeToggle) {
        const updateThemeControl = isDark => {
            themeToggle.setAttribute("aria-label", isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
            themeToggle.title = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
            themeToggle.textContent = isDark ? "☀" : "☾";
        };
        updateThemeControl(savedTheme === "dark");
        themeToggle.addEventListener("click", () => {
            const isDark = document.documentElement.dataset.theme !== "dark";
            document.documentElement.dataset.theme = isDark ? "dark" : "light";
            try { localStorage.setItem("nexora-theme", isDark ? "dark" : "light"); } catch (_) { /* Theme still changes for this visit. */ }
            updateThemeControl(isDark);
        });
    }

    const readingProgress = document.getElementById("readingProgress");
    const readingProgressFill = readingProgress?.querySelector("span");
    const backToTop = document.getElementById("backToTop");
    let scrollFrame = 0;
    const updateScrollControls = () => {
        scrollFrame = 0;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const percent = scrollable > 0 ? Math.min(100, Math.round((window.scrollY / scrollable) * 100)) : 100;
        if (readingProgress && readingProgressFill) {
            readingProgressFill.style.transform = `scaleX(${percent / 100})`;
            readingProgress.setAttribute("aria-valuenow", String(percent));
        }
        if (backToTop) backToTop.hidden = window.scrollY < 420;
    };
    const scheduleScrollUpdate = () => {
        if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollControls);
    };
    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollUpdate);
    updateScrollControls();
    backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

    const quickAnswer = document.getElementById("quickAnswer");
    const checkQuickAnswer = document.getElementById("checkQuickAnswer");
    const practiceFeedback = document.getElementById("practiceFeedback");
    if (quickAnswer && checkQuickAnswer && practiceFeedback) {
        const checkPracticeAnswer = () => {
            const normalize = value => value.trim().toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const expected = normalize(checkQuickAnswer.dataset.answer || "");
            const actual = normalize(quickAnswer.value);
            const correct = Boolean(actual) && actual === expected;
            practiceFeedback.textContent = correct
                ? "¡Correcto! La respuesta coincide."
                : actual ? "Revisa la respuesta y vuelve a intentarlo. Puedes abrir la pista." : "Escribe una respuesta antes de comprobarla.";
            practiceFeedback.className = correct ? "feedback-correct" : "feedback-review";
        };
        checkQuickAnswer.addEventListener("click", checkPracticeAnswer);
        quickAnswer.addEventListener("keydown", event => {
            if (event.key === "Enter") checkPracticeAnswer();
        });
    }

    const convertFraction = document.getElementById("convertFraction");
    if (convertFraction) {
        convertFraction.addEventListener("click", () => {
            const numerator = Number(document.getElementById("fractionNumerator").value);
            const denominator = Number(document.getElementById("fractionDenominator").value);
            const result = document.getElementById("fractionResult");
            if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
                result.textContent = "Introduce números válidos y un denominador distinto de cero.";
                return;
            }
            const percentage = Math.round((numerator / denominator) * 10000) / 100;
            result.textContent = `${numerator}/${denominator} equivale a ${percentage}% (${numerator} ÷ ${denominator} × 100).`;
        });
    }

    if (searchButton) {
        searchButton.addEventListener("click", searchCategories);
    }

    const aiTaskSelect = document.getElementById("aiTaskSelect");
    const aiTaskPanels = document.querySelectorAll("[data-ai-task-panel]");
    const aiTaskStatus = document.getElementById("aiTaskStatus");
    if (aiTaskSelect) {
        aiTaskSelect.addEventListener("change", () => {
            const selectedTask = aiTaskSelect.value;
            let visibleCount = 0;
            aiTaskPanels.forEach(panel => {
                const show = Boolean(selectedTask) && panel.dataset.aiTaskPanel === selectedTask;
                panel.hidden = !show;
                if (show) visibleCount = panel.querySelectorAll("[data-ai-plan]:not([hidden])").length;
            });
            if (aiTaskStatus) {
                const label = aiTaskSelect.options[aiTaskSelect.selectedIndex]?.textContent;
                const isEnglish = document.documentElement.lang === "en";
                const activeFilter = document.querySelector('[data-plan-filter][aria-pressed="true"]')?.dataset.planFilter || "all";
                aiTaskStatus.textContent = selectedTask
                    ? isEnglish
                        ? `${visibleCount} ${activeFilter === "all" ? "free and paid " : `${activeFilter} `}recommendations for: ${label}.`
                        : `${visibleCount} recomendaciones ${activeFilter === "all" ? "gratuitas y de pago" : activeFilter === "free" ? "gratuitas" : "de pago"} para: ${label}.`
                    : isEnglish ? "Choose a task to see recommended AI tools." : "Selecciona una tarea para ver herramientas recomendadas.";
            }
        });
    }

    const planFilters = document.querySelectorAll("[data-plan-filter]");
    const planPanels = document.querySelectorAll("[data-plan-panel]");
    const quickPlanCards = document.querySelectorAll("[data-ai-plan]");
    const quickPlanGroups = document.querySelectorAll("[data-ai-plan-group]");
    const planFilterStatus = document.getElementById("planFilterStatus");
    planFilters.forEach(button => {
        button.addEventListener("click", () => {
            const filter = button.dataset.planFilter;
            planFilters.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
            planPanels.forEach(panel => { panel.hidden = filter !== "all" && panel.dataset.planPanel !== filter; });
            quickPlanCards.forEach(card => {
                card.hidden = filter !== "all" && card.dataset.aiPlan !== filter;
            });
            quickPlanGroups.forEach(group => {
                group.hidden = !group.querySelector("[data-ai-plan]:not([hidden])");
            });
            if (planFilterStatus) {
                const isEnglish = document.documentElement.lang === "en";
                const selectedTask = document.getElementById("aiTaskSelect")?.value;
                const selectedPanel = selectedTask
                    ? [...aiTaskPanels].find(panel => panel.dataset.aiTaskPanel === selectedTask)
                    : null;
                const quickCount = selectedPanel
                    ? selectedPanel.querySelectorAll("[data-ai-plan]:not([hidden])").length
                    : 0;
                planFilterStatus.textContent = isEnglish
                    ? filter === "all"
                        ? "Showing free and paid tools in the task finder and detailed lists."
                        : `Showing ${filter === "free" ? "free" : "paid"} recommendations${selectedTask ? ` (${quickCount} in the selected task)` : ""}.`
                    : filter === "all"
                        ? "Se muestran las herramientas gratuitas y de pago en el buscador y en las listas detalladas."
                        : `Se muestran recomendaciones ${filter === "free" ? "gratuitas" : "de pago"}${selectedTask ? ` (${quickCount} en la tarea seleccionada)` : ""}.`;
            }
        });
    });

    const gameFilters = document.querySelectorAll("[data-game-filter]");
    const gameCards = document.querySelectorAll("[data-game-access]");
    const gameFilterStatus = document.getElementById("gameFilterStatus");
    gameFilters.forEach(button => {
        button.addEventListener("click", () => {
            const filter = button.dataset.gameFilter;
            gameFilters.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
            let visible = 0;
            gameCards.forEach(card => {
                const show = filter === "all" || card.dataset.gameAccess === filter;
                card.hidden = !show;
                if (show) visible++;
            });
            if (gameFilterStatus) {
                const isEnglish = document.documentElement.lang === "en";
                gameFilterStatus.textContent = isEnglish
                    ? `Showing ${visible} recommendation${visible === 1 ? "" : "s"}.`
                    : `Se muestran ${visible} ${visible === 1 ? "recomendación" : "recomendaciones"}.`;
            }
        });
    });


    // ========================================
    // AÑO AUTOMÁTICO DEL FOOTER
    // ========================================

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }


    // ========================================
    // DESPLAZAMIENTO SUAVE
    // ========================================

    document.querySelectorAll('a[href^="#"]').forEach(link => {

        link.addEventListener("click", event => {

            const targetId = link.getAttribute("href");

            if (!targetId || targetId === "#") {
                return;
            }

            const target = document.querySelector(targetId);

            if (target) {
                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        });
    });

});
