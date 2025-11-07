<?php
namespace Sulit;

class Portal
{
    public const DEFAULT_HTML = <<<'HTML'
<!-- 
  Welcome to the SULIT WIFI Portal Editor!
  Default portal content.
-->
<div style="font-family: sans-serif; text-align: center; padding: 2em; color: #333;">
  <h1>Welcome to SULIT WIFI!</h1>
  <p>This is your default portal content.</p>
  <p>You can edit this HTML in the Admin Panel under "Portal Editor".</p>
  <p>Rendered by PHP backend.</p>
  </div>
HTML;
}