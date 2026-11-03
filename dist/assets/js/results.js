document.addEventListener("DOMContentLoaded", () => {
    const isEnglish = document.documentElement.lang === "en";
    const lead = document.getElementById("resultLead");
    const scoreCard = document.getElementById("resultScoreCard");
    const review = document.getElementById("answerReview");
    const reviewLink = document.getElementById("reviewLessonLink");
    const retryLink = document.getElementById("retryLessonLink");

    let result;
    try {
        result = JSON.parse(window.sessionStorage.getItem("nexora-exam-result") || "null");
    } catch (_) {
        result = null;
    }

    if (!result || !Array.isArray(result.answers) || !result.answers.length) {
        lead.textContent = isEnglish
            ? "No quiz result was found in this tab. Complete a quiz to see your score and explanations here."
            : "No encontramos un resultado en esta pestaña. Completa un examen para ver aquí tu puntuación y las explicaciones.";
        return;
    }

    const score = Number(result.score);
    const total = result.answers.length;
    if (!Number.isInteger(score) || score < 0 || score > total || typeof result.lessonTitle !== "string") {
        lead.textContent = isEnglish
            ? "The quiz summary could not be read. Return to the lesson and try again."
            : "El resumen del examen no se pudo leer. Vuelve a la lección e inténtalo de nuevo.";
        return;
    }

    const percent = Math.round((score / total) * 100);
    const unanswered = result.answers.filter(answer => answer.selected === null).length;
    document.title = `${isEnglish ? "Result" : "Resultado"}: ${result.lessonTitle} | NEXORA`;
    lead.textContent = result.lessonTitle;
    document.getElementById("resultPercent").textContent = `${percent}%`;
    document.getElementById("resultScore").textContent = isEnglish
        ? `${score} out of ${total} answers correct${unanswered ? ` · ${unanswered} unanswered` : ""}.`
        : `${score} de ${total} respuestas correctas${unanswered ? ` · ${unanswered} sin responder` : ""}.`;
    document.getElementById("resultTitle").textContent = isEnglish
        ? percent >= 80 ? "Strong understanding!" : percent >= 60 ? "You are making progress" : "Review and try again"
        : percent >= 80 ? "¡Buen dominio del tema!" : percent >= 60 ? "Vas por buen camino" : "Repasa y vuelve a intentarlo";
    document.getElementById("resultMessage").textContent = isEnglish
        ? percent >= 80
            ? "Your result shows a strong understanding. Review the explanations to reinforce it."
            : percent >= 60
                ? "You have a good foundation. Reviewing the answers can help you fill in the gaps."
                : "Use each explanation to identify what to review, then try again."
        : percent >= 80
            ? "Tu resultado muestra una buena comprensión. Revisa las explicaciones para consolidarla."
            : percent >= 60
                ? "Ya tienes una base. La revisión te ayudará a fijar los pasos que faltan."
                : "No pasa nada: usa cada explicación para localizar qué repasar y prueba otra vez.";
    document.getElementById("resultScoreRing").style.setProperty("--score-angle", `${percent * 3.6}deg`);
    scoreCard.hidden = false;

    const fragment = document.createDocumentFragment();
    result.answers.forEach((answer, index) => {
        const correct = answer.selected === answer.correctAnswer;
        const card = document.createElement("article");
        card.className = `answer-review-card ${correct ? "is-correct" : "needs-review"}`;

        const heading = document.createElement("h3");
        heading.textContent = isEnglish
            ? `Question ${index + 1} · ${correct ? "Correct" : "Review"}`
            : `Pregunta ${index + 1} · ${correct ? "Correcta" : "Para repasar"}`;
        const question = document.createElement("p");
        question.textContent = answer.question;
        const yourAnswer = document.createElement("p");
        yourAnswer.textContent = isEnglish
            ? `Your answer: ${answer.selected === null ? "Unanswered" : answer.options?.[answer.selected] ?? "Unavailable"}`
            : `Tu respuesta: ${answer.selected === null ? "Sin responder" : answer.options?.[answer.selected] ?? "No disponible"}`;
        card.append(heading, question, yourAnswer);

        if (!correct) {
            const correctAnswer = document.createElement("p");
            correctAnswer.textContent = isEnglish
                ? `Correct answer: ${answer.options?.[answer.correctAnswer] ?? "Unavailable"}`
                : `Respuesta correcta: ${answer.options?.[answer.correctAnswer] ?? "No disponible"}`;
            card.appendChild(correctAnswer);
        }
        const explanation = document.createElement("p");
        explanation.className = "answer-explanation";
        explanation.textContent = `${isEnglish ? "Explanation" : "Explicación"}: ${answer.explanation}`;
        card.appendChild(explanation);
        fragment.appendChild(card);
    });
    review.replaceChildren(fragment);

    if (typeof result.lessonUrl === "string" && result.lessonUrl.startsWith("../pages/")) {
        reviewLink.href = result.lessonUrl;
        retryLink.href = result.lessonUrl;
        reviewLink.hidden = false;
        retryLink.hidden = false;
    }
});
