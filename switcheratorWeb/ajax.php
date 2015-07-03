<?php

// if we are supressing radio output
global $debug;
//$debug = true;
$debug = false;

global $db;
$db = new SQLite3('../myradiodb.php');
if (function_exists($_GET['function']))
    echo $_GET['function']();
else
    echo "Error";


/*
 * Return the list of radios
 */

function getRadios() {
    global $db;
    $sql = "select * from radios";
    $result = $db->query($sql);
    while ($row = $result->fetchArray(SQLITE3_ASSOC))
        $radioInfo[] = $row;
    return json_encode($radioInfo);
}

/*
 * Return the summary of a single radio
 */

function radioDetails() {
    $radioID = intval($_GET['radioID']);
    global $db;
    // check if the radio is valid
    $sql = "select * from radios where id = :radioID";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":radioID", $radioID))
        return (json_encode(array("fail" => $db->lastErrorMsg())));
    $result = $statement->execute();
    $row = $result->fetchArray();
    if ($row == false)
        return (json_encode(array("fail" => "Invalid radio id")));
    $outArray['radio'] = $row;

    $sqlArray = array(
        array("switches", "select * from switches where radioID = :radioID and switchStuff != 255"),
        array("programs", "select * from programs where radioID = :radioID and time != 65535"),
        array("inputs", "select * from inputs where radioID = :radioID and pinStuff != 255"),
        array("colors", "select * from colorChanges where radioID = :radioID and (red != 0 or green != 1 or blue != 0)"),
        array("timeLimits", "select * from timeLimits where radioID = :radioID and (startTime != 0 or stopTime != 0 or days != 0)")
    );
    foreach ($sqlArray as $sqlItem) {
        $sql = $sqlItem[1];
        $statement = $db->prepare($sql);
        if (!$statement->bindValue(":radioID", $radioID, SQLITE3_INTEGER))
            echo $db->lastErrorMsg();
        $result = $statement->execute();
        $data = array();
        while ($row = $result->fetchArray())
            $data[] = $row;
        $outArray[$sqlItem[0]] = $data;
    }

    if (isset($_GET['debug'])) {
        echo "<pre>";
        print_r($outArray);
        echo "</pre>";
    }
    return json_encode($outArray);
}

// gets and does a command to the radio
function sendRadioCommand($command = "") {
    if($command == "")
        $command = $_POST['command'];
    if(is_array($command)) {
        while(count($command) > 0) {
            $thisCommand = array_shift($command);
            $returnMe = sendRadioCommand($thisCommand);
        }
        if($returnMe == true)
            return "ok";
        else
            return "Invalid Command.";
    }
    $radioID = intval($_POST['radioID']);
    if (preg_match('/^[a-zA-Z0-9:-]+$/', $command) != 1)
        return "Invalid command. $command<br>";
    include_once("functions.php");
    $response = radioCommand($radioID, $command,"ok");
    if ($response == false)
        return "Invalid command! $command<br>";
    if(isset($_POST['save'])) {
        radioCommand($radioID, "SA");
    }
    return "ok";
}

// redoes the database based on the radio
function processRadioCommand() {
    $radioID = intval($_POST['radioID']);
    include_once("functions.php");
    if (processRadio($radioID))
        return "ok";
    else
        return "error";
}

function radioChangeName() {
    global $db;
    $sql = "update radios set name = :name, description = :description, location = :location where id = :radioID";
    $statement = $db->prepare($sql);
    if (!$statement->bindValue(":name", $_POST['name'], SQLITE3_TEXT))
        die($db->lastErrorMessage());
    if (!$statement->bindValue(":description", $_POST['description'], SQLITE3_TEXT))
        die($db->lastErrorMessage());
    if (!$statement->bindValue(":location", $_POST['location'], SQLITE3_TEXT))
        die($db->lastErrorMessage());
    if (!$statement->bindValue(":radioID", $_POST['radioID'], SQLITE3_INTEGER))
        die($db->lastErrorMessage());
    $result = $statement->execute();
    if ($result == false)
        die($db->lastErrorMessage());
    return "ok";
}

// Process new radio
function processNewRadio() {
    $name = $_POST['name'];
    if(isset($_POST['description'])) {
        $description = $_POST['description'];
    } else {
        $description = "";
    }
    if(isset($_POST['location'])) {
        $location = $_POST['location'];
    } else {
        $location = "";
    }
    include_once('functions.php');
    return newRadio($name, $description, $location);
}

// Process radio that already has its own channel
function processExistingRadio() {
    $name = $_POST['name'];
    if(isset($_POST['description'])) {
        $description = $_POST['description'];
    } else {
        $description = "";
    }
    if(isset($_POST['location'])) {
        $location = $_POST['location'];
    } else {
        $location = "";
    }
    $channel = $_POST['channel'];
    if (preg_match('/^[a-zA-Z0-9:-]+$/', $channel) != 1)
        return "Invalid channel.";
    include_once('functions.php');
    return existingNewRadio($name, $description, $location, $channel);
}

function updateRadio() {
    include_once('functions.php');
    return processRadio($_POST['radioID']);
}


function updateTime() {
    $radioID = intval($_POST['radioID']);
    include_once("functions.php");
    $response = radioCommand($radioID, "","/");
    if ($response == false)
        return "fail";
    return "ok";
}


?>
