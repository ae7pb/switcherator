<style>
    div div {
        width: 200px;
        height: 300px;
        outline: 1px solid;
        float: left;
        margin: 10px;
    }
    div div span.link {
        position: absolute;
        width: 200px;
        height: 300px;
    }
    span.blue {
        background-color: blue;
    }
    span.red {
        background-color: red;
    }
    span.purple {
        background-color: purple;
    }
    span.orange {
        background-color: orange;
    }
    span.green {
        background-color: lime;
    }
    span.yellow {
        background-color: yellow;
    }
    span.orangered {
        background-color: orangered;
    }
    span.forestgreen {
        background-color: forestgreen;
    }
    span.fuchsia {
        background-color: fuchsia;
    }
    span.crimson {
        background-color: crimson;
    }
</style>


<div>
<?PHP
// decide how we are running and do an appropriate new line
if (php_sapi_name() == "cli")
    $nl = "\n";
else
    $nl = "<br/>";

global $db;
$db = new SQLite3('myradiodb.php');

// Radio table.  Has the radio, serial numbers and switch capabilities
$db->exec("CREATE TABLE IF NOT EXISTS radios (
    id int PRIMARY KEY,
    name text,
    description text,
    location text,
    switchCount int,
    programCount int,
    inputCount int,
    timeLimitCount int,
    txAddress text,
    rxAddress0 text,
    rxAddress1 text,
    rxAddress2 text,
    rxAddress3 text,
    rxAddress4 text,
    rxAddress5 text
)");
// Switch table.  Which radio it has, switch number on radio, type of switch and details.
// Types: Binary, PWM Single Color, PWM Color Change, PWM Hue change
// Details as appropriate
$db->exec("CREATE TABLE IF NOT EXISTS switches (
    id int PRIMARY KEY,
    radioID int,
    switchNumber int,
    type text,
    details text
)");
// Program table.  Which radio, program number, start time, duration in minutes, 
// days and which switches it uses.  So it is searchable the days will be
// Sun Mon Tue Wed Thu Fri Sat
$db->exec("CREATE TABLE IF NOT EXISTS programs (
    id int PRIMARY KEY,
    radioID int,
    programNumber int,
    time text,
    duration int,
    days text,
    switches text
)");
// Input table. Which radio, input number, details is port / pin / percentages of on off,
// program is the program or switch that it turns on, duration is time in seconds that 
// the switch stays on, poll time is seconds or 0 for continuous
// for the program indicate if this is doing various things based on analog info and
// which RGB colors are affected by analog info
$db->exec("CREATE TABLE IF NOT EXISTS inputs (
    id int PRIMARY KEY,
    radioID int,
    inputNumber int,
    details text,
    program text,
    duration int,
    pollTime int
)");
/*
 * Time limit table.  This sets up when a program will react to an input
 * Start time, stop time. Days is same format as programs
 */
$db->exec("CREATE TABLE IF NOT EXISTS timeLimits (
    id int PRIMARY KEY,
    radioID int,
    limitNumber int,
    startTime text,
    stopTime text,
    days text
)");

//  TODO: colorful layout, switches side by side showing how many it has and if they are programmed or not.


getRadioInfo("100001");

function radioCommand($radioID,$command,$desiredLine) {
    global $db;
    $statement = $db->prepare("SELECT * FROM radios WHERE id = :id");
    $statement->bindValue(":id",$radioID,SQLITE3_INTEGER);
    $result = $statement->execute();
    $radio = $result->fetchArray(SQLITE3_ASSOC);
    $commandToRun = "nrfcl -t ".$radio['rxAddress0']." -r ".$radio['txAddress']." ".$command;
    // TODO: you are here
    $attempts = 0;
    while ($attempts < 10){
        $attempts++;
        $returnArray = array();
        exec($command, $returnArray);
        // make sure we got something
        foreach($returnArray as $line) {
            // see if we got the response we are looking for
            if(strpos($line,$desiredLine) === 0)
                return $line;
        }
        usleep(10000);
    }
    return false;
}

function getRadioInfo($serialNum) {
    global $nl, $db;
    if (strlen($serialNum) < 6)
        return "invalid serial number$nl";
    $attempts = 0;
    $time = 0;
    // Read a general status
    $command = "nrfcl z" . $serialNum . "gs";
    if(!$line = parseCommand($command,"S#")) {
        echo "Cannot reach radio.  Sorry.";
        exit;
    }

    $timeString = substr($line,11,19);
    $time = strtotime($timeString);


    echo date("Y:m:d H:i:s",$time).$nl;

    $command = "nrfcl z".$serialNum."gi";
    if(!$Line = parseCommand($command,"S")) {
        echo "Can't get summary info$nl";
    }

}


?>
    <div><a href="#"><span class="link blue"></span></a></div>
    <div><a href="#"><span class="link red"></span></a></div>
    <div><a href="#"><span class="link purple"></span></a></div>
    <div><a href="#"><span class="link orange"></span></a></div>
    <div><a href="#"><span class="link green"></span></a></div>
    <div><a href="#"><span class="link yellow"></span></a></div>
    <div><a href="#"><span class="link orangered"></span></a></div>
    <div><a href="#"><span class="link forestgreen"></span></a></div>
    <div><a href="#"><span class="link fuchsia"></span></a></div>
    <div><a href="#"><span class="link crimson"></span></a></div>
</div>
