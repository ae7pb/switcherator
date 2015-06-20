<?php

global $db;
$db = new SQLite3('myradiodb.php');
switch ($_GET['function']) {
    case "getRadios":
        echo getRadios();
        break;
    case "radioDetails":
        echo radioDetails($_GET['radioID']);
        break;
    case "radioCommand":
        echo sendRadioCommand();
        break;
    case "radioChangeName":
        echo radioChangeName();
        break;
}

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

function radioDetails($radioID) {
    $radioID = intval($radioID);
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
function sendRadioCommand() {
    $command = $_POST['command'];
    $radioID = intval($_POST['radioID']);
    if (preg_match('/^[a-zA-Z0-9]+$/', $command) !== 1)
        return json_encode(array("fail" => "Invalid command."));
    include_once("functions.php");
    $response = radioCommand($radioID, $command);
    if ($response == false)
        return json_encode(array("fail" => "Invalid command!"));
    return json_encode($response);
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
    if($result == false)
        die($db->lastErrorMessage());
    return "ok";
}

?>