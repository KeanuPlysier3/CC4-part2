import { WebSerial } from './serial.js';
//dom elements
let $secondScreen
let $header;
let $title;
let $main;
// let $startBtn;
let $callibrateBtn;

let $connectBtn;
let $description;
let $colorBox;
let $score;
let $body;
let $scoreBoard;

let data;
let expectedColor = null;
let testActive = false;
let round = 0;


//arrays
let times = [];
let colors = ["red", "green", "blue"];
let scores = [];
//globals
let startTime;
let endTime;


//new webserial instance
const serial = new WebSerial({
    usbVendorId: 6790,
    usbProductId: 21971,
    baudRate: 9600,
    autoConnect: true,
    autoReconnect: true,
});

const init = async () => {
    querySelectors();
    eventListeners();
    displaySupported();

    if (!serial.isSupported) return;
    serial.addEventListener("connect", async () => {
        displayConnectionState();
        await serial.sendJSON({ device: "buzzer", message: "start" });
        await serial.sendJSON({ device: "leds" });
    });

    serial.addEventListener("disconnect", () => {
        displayConnectionState();

    });

    serial.addEventListener('data', async (e) => {
        data = e.detail.data;
        try {
            const json = JSON.parse(data);
            console.log(json);
            if (json.device === `photoRes`) {


                // $main.classList.toggle("body--dark");

                $body.classList.toggle("body--dark");
            }
            // Only allow 'start' button to start the test if not active and at the beginning
            else if (json.btn === "start") {
                if (!testActive && round === 0) {
                    startTest();
                } // else: ignore 'start' during active test
            }
            else if (testActive && expectedColor && json.btn === expectedColor) {
                endTimer();
                await serial.sendJSON({ device: "led", led: "none" });
                $colorBox.style.backgroundColor = "transparent";
                round++;
                expectedColor = null;
                testActive = false;
                nextRound();
            }
            else if (testActive && expectedColor && json.btn !== expectedColor) {

                await serial.sendJSON({ device: "buzzer", message: "wrong" });
            }
        } catch (err) {
            console.log('Received raw:', data);
        }
    });
    serial.init();
}



const displayConnectionState = () => {
    if (serial.isConnected) {
        $secondScreen.style.display = "flex";
        $connectBtn.style.display = "none";
    } else {
        $secondScreen.style.display = "none";
        $connectBtn.style.display = "inline-block";
    }
}



const displaySupported = () => {
    if (serial.isSupported) {
        return
    }
    else {
        alert("WebSerialAPI is crucial for this project, unfortunately your current browser does not support it.")
    }
}


const querySelectors = () => {
    $title = document.querySelector(".title");
    $header = document.querySelector('header');
    $score = document.querySelector('.score');
    $title = document.querySelector('.title');
    $main = document.querySelector('main');
    $secondScreen = document.querySelector('.second__screen');
    $description = document.querySelector('.project__description');
    // $startBtn = document.querySelector('.start__btn');
    $callibrateBtn = document.querySelector('.callibrate__btn');
    $body = document.querySelector('body');
    $scoreBoard = document.querySelector('.scoreboard__list');

    $connectBtn = document.querySelector('.connect__btn');
    $colorBox = document.querySelector('.project__colors');


    if (JSON.parse(localStorage.getItem("scores"))) {
        scores = JSON.parse(localStorage.getItem("scores"));
    }
    updateScoreBoard();


}
const eventListeners = () => {
    $connectBtn.addEventListener('click', (e) => { selectBoard(e); })
    // $startBtn.addEventListener('click', (e) => { startTest(e); });
    $callibrateBtn.addEventListener('click', async (e) => {
        // Add spinner
        if (!$callibrateBtn.querySelector('.spinner')) {
            const spinner = document.createElement('span');
            spinner.className = 'spinner';
            $callibrateBtn.appendChild(spinner);
        }
        $callibrateBtn.disabled = true;
        await serial.sendJSON({ device: "photoRes" });
        setTimeout(() => {
            const spinner = $callibrateBtn.querySelector('.spinner');
            if (spinner) spinner.remove();
            $callibrateBtn.disabled = false;
        }, 2000);
    })
}



const selectBoard = async () => {
    await serial.requestPort();
}

const startTest = () => {
    $title.style.display = "none"
    times = [];
    $score.style.display = "none";
    $description.style.display = "none";
    // $startBtn.style.display = "none";


    nextRound();
}

const nextRound = () => {
    if (round >= 3) {
        console.log("Done!", times);

        // $startBtn.style.display = "inline-block";
        testActive = false;
        finalScore();
        return;
    }

    const waitTime = randomTime();

    setTimeout(async () => {
        if (round >= 3) return; //preventing overlapping rounds started before round variables could be updated.
        startTimer();
        expectedColor = await changeColor();
        testActive = true;
    }, waitTime);
}




const changeColor = async () => {
    const index = Math.floor(Math.random() * 3);
    let color = colors[index];

    switch (color) {
        case "red":
            $colorBox.style.backgroundColor = "var(--color-red)";
            await serial.sendJSON({ device: "led", led: "red" });
            break;

        case "blue":
            $colorBox.style.backgroundColor = "var(--color-blue)";
            await serial.sendJSON({ device: "led", led: "blue" });
            break;

        case "green":
            $colorBox.style.backgroundColor = "var(--color-green)";
            await serial.sendJSON({ device: "led", led: "green" });
            break;
    }
    return color;
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

const updateScoreBoard = () => {
    while ($scoreBoard.firstChild) { //keeps removing all first_children until none are left.
        $scoreBoard.removeChild($scoreBoard.firstChild);
    }

    scores.map(score => {
        let $score = document.createElement("li");
        $score.textContent = `${score}s`;
        $score.classList.add('scoreboard__score');
        $scoreBoard.appendChild($score);
    })
}

const finalScore = async () => {
    await serial.sendJSON({ device: "buzzer", message: "victory" });
    $title.style.display = "inline"
    $score.style.display = "block";
    $description.style.display = "block";
    console.log(times);
    const average = times.reduce((sum, time) => sum + time, 0) / times.length;
    const seconds = average / 1000;
    const time = seconds.toFixed(2)
    $score.textContent = "avg reaction speed = " + time + "s";

    scores.push(time);
    scores.sort((a, b) => a - b); //from fastest to slowest
    scores = scores.slice(0, 5); //keep top 5;
    localStorage.setItem("scores", JSON.stringify(scores));
    updateScoreBoard()
    round = 0;
}

init();