
$(document).ready(function () {
    $.get("ajax.php"
            , {function: "getRadios"}
            , function(response){
                radioDivs(response)
            }
            , "json");
    navigationBar(null);

});

/*
 * 
 * Shows the navigation bar
 */
function navigationBar(radioText) {
    var container = $("#navBar");
    container.html("<div class=subNav><b>Hello&nbsp;</b></div><div class=subNav>there</div>");

}

/*
 * Populate the existing radioDiv element with a new box for each radio
 */
function radioDivs(response) {

    response.forEach(function(radio) {
        var output = radio.radioId;
        var container = $("#radioList");
        var radioNum = container.children().length; // change this to radioId when we have data
        container.append(
                "<div id=radio-" + radioNum + " class=radios>"+output+"</div>"
                );
    })
}
/*
 * $('.ring-preview').children('img').each(function(i) { 
    $(this).rotate(ring.stones[i].stone_rotation);
});
 */