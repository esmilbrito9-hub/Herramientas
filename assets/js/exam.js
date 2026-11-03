
document.addEventListener("DOMContentLoaded", () => {

    const examDataElement = document.getElementById("examData");
    const questionsContainer = document.getElementById("examQuestions");
    const submitButton = document.getElementById("submitExam");
    const retryButton = document.getElementById("retryExam");
    const resultsContainer = document.getElementById("examResults");
    const progressElement = document.getElementById("examProgress");
    const progressTrack = document.getElementById("examProgressTrack");
    const examContainer = document.getElementById("examContainer");
    const isEnglish = document.documentElement.lang === "en";

    if (
        !examDataElement ||
        !questionsContainer ||
        !submitButton ||
        !retryButton ||
        !resultsContainer
    ) {
        return;
    }

    let exam;

    try {
        exam = JSON.parse(examDataElement.textContent);
    } catch (error) {
        questionsContainer.textContent =
            "No se pudo cargar el examen.";
        submitButton.disabled = true;
        return;
    }

    const questions = exam.questions || [];

    if (questions.length === 0) {
        questionsContainer.textContent =
            "Este examen todavía no tiene preguntas.";
        submitButton.disabled = true;
        return;
    }


    // ========================================
    // MOSTRAR PREGUNTAS
    // ========================================

    function renderQuestions() {

        questionsContainer.replaceChildren();

        questions.forEach((question, index) => {

            const questionCard = document.createElement("article");
            questionCard.className = "question-card";

            const title = document.createElement("h3");
            title.id = `question-title-${index}`;
            title.textContent =
                `${index + 1}. ${question.question}`;

            questionCard.appendChild(title);

            const optionsContainer = document.createElement("fieldset");
            optionsContainer.className = "question-options";
            optionsContainer.setAttribute("aria-labelledby", title.id);

            question.options.forEach((option, optionIndex) => {

                const label = document.createElement("label");
                label.className = "question-option";

                const input = document.createElement("input");

                input.type = "radio";
                input.name = `question-${index}`;
                input.value = optionIndex;

                const text = document.createElement("span");
                text.textContent = option;

                label.appendChild(input);
                label.appendChild(text);

                optionsContainer.appendChild(label);
            });

            questionCard.appendChild(optionsContainer);

            questionsContainer.appendChild(questionCard);
        });

        questionsContainer.querySelectorAll('input[type="radio"]').forEach(input => {
            input.addEventListener("change", updateProgress);
        });
        updateProgress();

        resultsContainer.hidden = true;
        retryButton.hidden = true;
        submitButton.hidden = false;
        submitButton.disabled = false;
    }

    function updateProgress() {
        if (!progressElement) return;
        const answered = new Set(
            [...questionsContainer.querySelectorAll('input[type="radio"]:checked')]
                .map(input => input.name)
        ).size;
        progressElement.textContent = isEnglish
            ? `${answered} of ${questions.length} questions answered`
            : `${answered} de ${questions.length} preguntas respondidas`;
        if (progressTrack) {
            progressTrack.setAttribute("aria-valuenow", String(answered));
            progressTrack.style.setProperty("--exam-progress", `${(answered / questions.length) * 100}%`);
        }
    }


    // ========================================
    // CORREGIR EXAMEN
    // ========================================

    function gradeExam() {

        let score = 0;
        let unanswered = 0;

        const questionCards =
            questionsContainer.querySelectorAll(".question-card");

        questions.forEach((question, index) => {

            const selected = document.querySelector(
                `input[name="question-${index}"]:checked`
            );

            const card = questionCards[index];

            const options = card.querySelectorAll(".question-option");

            options.forEach((option, optionIndex) => {

                const input = option.querySelector("input");

                input.disabled = true;

                if (optionIndex === question.answer) {
                    option.classList.add("correct-answer");
                }

                if (input.checked && optionIndex !== question.answer) {
                    option.classList.add("incorrect-answer");
                }
            });

            if (!selected) {
                unanswered++;
            } else if (Number(selected.value) === question.answer) {
                score++;
            }

            const explanation = document.createElement("p");
            explanation.className = "question-explanation";

            explanation.textContent =
                `${isEnglish ? "Explanation" : "Explicación"}: ${question.explanation}`;

            card.appendChild(explanation);
        });

        const percentage = Math.round(
            (score / questions.length) * 100
        );

        const answers = questions.map((question, index) => {
            const selected = questionsContainer.querySelector(`input[name="question-${index}"]:checked`);
            return {
                question: question.question,
                options: question.options,
                selected: selected ? Number(selected.value) : null,
                correctAnswer: question.answer,
                explanation: question.explanation,
            };
        });
        const resultUrl = examContainer?.dataset.resultUrl;
        if (resultUrl) {
            try {
                window.sessionStorage.setItem("nexora-exam-result", JSON.stringify({
                    lessonTitle: examContainer.dataset.lessonTitle || "Examen de NEXORA",
                    lessonUrl: examContainer.dataset.resultLessonUrl || "",
                    score,
                    answers,
                }));
                window.location.assign(resultUrl);
                return;
            } catch (_) {
                // If this browser blocks session storage, keep the inline result available.
            }
        }

        resultsContainer.replaceChildren();

        const resultTitle = document.createElement("h3");
        resultTitle.textContent = isEnglish ? "Quiz result" : "Resultado del examen";

        const resultScore = document.createElement("p");
        resultScore.textContent =
            (isEnglish ? `You got ${score} out of ${questions.length} answers correct.` : `Obtuviste ${score} de ${questions.length} respuestas correctas.`);

        const resultPercentage = document.createElement("p");
        resultPercentage.textContent =
            `${isEnglish ? "Score" : "Puntuación"}: ${percentage}%`;

        const resultMessage = document.createElement("p");

        if (percentage === 100) {
            resultMessage.textContent =
                isEnglish ? "Excellent! You answered every question correctly." : "¡Excelente! Has respondido todas las preguntas correctamente.";
        } else if (percentage >= 60) {
            resultMessage.textContent =
                isEnglish ? "Good work! Keep practicing to improve." : "¡Buen trabajo! Sigue practicando para mejorar.";
        } else {
            resultMessage.textContent =
                isEnglish ? "Review the lesson and try again." : "Te recomendamos repasar la lección y volver a intentarlo.";
        }

        resultsContainer.append(
            resultTitle,
            resultScore,
            resultPercentage,
            resultMessage
        );

        if (unanswered > 0) {
            const unansweredMessage = document.createElement("p");

            unansweredMessage.textContent =
                `${isEnglish ? "Unanswered questions" : "Preguntas sin responder"}: ${unanswered}.`;

            resultsContainer.appendChild(unansweredMessage);
        }

        resultsContainer.hidden = false;
        retryButton.hidden = false;
        submitButton.hidden = true;
    }


    // ========================================
    // REPETIR EXAMEN
    // ========================================

    function retryExam() {

        renderQuestions();

        questionsContainer.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }


    // ========================================
    // EVENTOS
    // ========================================

    submitButton.addEventListener("click", () => {

        const confirmed = window.confirm(
            "¿Quieres corregir tus respuestas?"
        );

        if (confirmed) {
            gradeExam();
        }

    });

    retryButton.addEventListener("click", retryExam);


    // INICIAR EXAMEN

    renderQuestions();

});
