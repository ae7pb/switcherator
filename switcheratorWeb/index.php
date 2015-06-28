<!DOCTYPE html>

<html>
    <head>
        <meta charset="UTF-8">
        <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js"></script>
        <script src="jsrender.min.js"></script>
        <script src="KitKatClock.min.js"></script>
        <script src="switcherator.js" type="text/javascript"></script>
        <link href="switcherator.css" rel="stylesheet" type="text/css"/>
        <link href="KitKatClock.min.css" rel="stylesheet" type="text/css" />
        <title></title>
    </head>
    <body>
        <?php
        
        include("functions.php");
        global $db;
        $db = new SQLite3('../myradiodb.php');
        redoDatabase();



        include("body.html");

        ?>
    </body>
</html>
