
//dom elements
let $header;
let $title;
let $main;
let $startBtn;
let $testBtn;
let $description;
let $colorBox;
let $score;

//arrays
let times = [];
let colors = ["r", "g", "b"];

//globals
let startTime;
let endTime;





const init = () => {
    querySelectors();
    eventListeners();
}


const querySelectors = () => {
    $header = document.querySelector('header');
    $score = document.querySelector('.score');
    $title = document.querySelector('.title');
    $main = document.querySelector('main');
    $description = document.querySelector('.project__descritption');
    $startBtn = document.querySelector('.start__btn');
    $testBtn = document.querySelector('.test__btn');
    $colorBox = document.querySelector('.project__colors');

}
const eventListeners = () => {
    $startBtn.addEventListener('click', (e) => { startTest(e); });
}
let round = 0;

const startTest = () => {
    $score.style.display = "none";
    $startBtn.style.display = "none";
    $testBtn.style.display = "inline-block";
    round = 0;
    nextRound();
}

const nextRound = () => {
    if (round >= 3) {
        console.log("Done!", times);
        $testBtn.style.display = "none";
        $startBtn.style.display = "inline-block";
        finalScore();
        return;
    }
    $testBtn.disabled = true;
    const waitTime = randomTime();

    setTimeout(() => {
        startTimer();
        changeColor();
        $testBtn.disabled = false;

        $testBtn.onclick = () => { //prevents stacking listeners
            endTimer();
            $colorBox.style.backgroundColor = "var(--color-white)";
            round++;
            nextRound();
        };
    }, waitTime);
}



const changeColor = () => {
    const index = Math.floor(Math.random() * 3);
    let color = colors[index];

    switch (color) {
        case "r":
            $colorBox.style.backgroundColor = "var(--color-red)";
            break;

        case "b":
            $colorBox.style.backgroundColor = "var(--color-blue)";
            break;

        case "g":
            $colorBox.style.backgroundColor = "var(--color-green)";
            break;
    }
};

const randomTime = () => {
    const waitTime = (Math.random() * 10000);
    console.log("waitingTime: " + waitTime);

    return waitTime;
}

const startTimer = () => {
    startTime = performance.now();
}

const endTimer = () => {
    endTime = performance.now();

    let totalTime = endTime - startTime;

    console.log("totalTime: " + totalTime);
    times.push(totalTime);
}

const finalScore = () => {
    $score.style.display = "block";
    const average = times.reduce((sum, time) => sum + time, 0) / times.length;
    const seconds = average / 1000;
    const time = seconds.toFixed(2)
    $score.textContent = "avg reaction speed = " + time + "s";
}

init();